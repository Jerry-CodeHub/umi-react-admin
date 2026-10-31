// 产物凭据泄露扫描（审计 security-6：曾发生 token 经 define 注入构建产物并部署到 gh-pages）
// 用法：node scripts/check-dist-secrets.mjs [产物目录，默认 dist]（需先构建；CI / Docker / Vercel 在构建后自动执行）
//
// 判定：产物里出现的 JWT 只可能是硬编码进源码/依赖的 token 或经构建注入的预期公开凭据，前者一律判失败。
// 白名单来源：
// 1. Cesium 源码自带的公开默认 ion token（@cesium/engine 的 Source/Core/Ion.js），
//    本模板不会启用它，但 SDK 仍会把该常量打入产物。从已安装的源码动态读取：
//    Cesium 升级换 token 不会误报；读取失败直接判失败，不会静默放行。
// 2. 类型化声明（审计 F3）：每一类构建期凭据都必须由对应的 EXPECTED_* 环境变量显式声明，
//    「设计上公开」才允许出现在公开产物里。脚本只以 sha256 指纹比对（不可逆），值不打印、不落日志：
//      CESIUM_ION_TOKEN       ← EXPECTED_CESIUM_TOKEN（JWT 形态；旧名 EXPECTED_TOKEN 仅作废弃别名）
//      AMAP_KEY               ← EXPECTED_AMAP_KEY（32 位十六进制高德 Web 端 Key）
//      AMAP_SECURITY_CODE     ← EXPECTED_AMAP_SECURITY_CODE（32 位十六进制安全密钥）
//    fail-closed 矩阵（任一命中即失败）：
//      a. config.ts / config.github.ts 的 define 块里由 process.env 派生的条目既没登记凭据类型、也没登记为
//         公开配置（PUBLIC_ENV_DEFINES）→ 冒烟点在源头被识别（防新增凭据漏声明）。「派生」包括间接绑定：
//         先赋给变量 / 解构 / 函数返回 / 从读取 process.env 的本地模块导入（逐层追踪），
//         define 块里无法静态识别的条目（展开、计算属性名）一律判失败
//      a'. umi 隐式通道：构建环境与 cwd 下 .env / .env.local 里的 UMI_APP_* 变量会被 umi 整体注入浏览器包的
//         process.env 对象（不经过 define 块），未登记为公开配置（PUBLIC_UMI_APP_VARS）的名字一律判失败
//      b. 构建期 define 已配置（非空）但未声明 EXPECTED_* → 「注入了却没声明」
//      c. 声明的值不是该类型的合法形态 → 「拼写残缺当成已声明」
//      d. 声明值与构建期 define 不一致 → 「声明的不是实际注入的那个」
//      e. 声明值在产物中一个都找不到 → 「扫描对象与发布对象不是同一份构建」
//    声明与 define 都必须通过形态校验，凭据被截断/带空白/被 shell 转义时不会静默放行。
// 3. 第二层检测：AWS/GitHub/OpenAI/Slack 前缀与 PEM 私钥块等非 JWT 形态密钥，无白名单，出现即失败。
// 输出只含文件路径与 sha256 指纹前缀，不打印凭据值（公开仓库的 CI 日志任何人可见）。
//
// 与发布产线的绑定：Dockerfile 构建层在同一 RUN 内「构建 → 扫描」；deploy.yml 扫描后生成
// scripts/verify-dist-integrity.mjs 的 sha256 清单，发布前再校验下载产物与清单一致（审计 F10）。
// 调用约定（b/d/e 三项成立的前提）：扫描进程必须拿到与构建期完全相同的那几组环境变量；
// 四条产线都在同一环境里传入（Vercel buildCommand 同一 shell、Docker 同一 RUN、CI/deploy 同一步的 env）。
// 本地注意：umi 的 loadEnv（@umijs/core dist/service/env.js）会无条件用 .env / .env.local 覆盖
// process.env 的同名变量（.env 先、.env.local 后）。因此本机存在 .env.local 时，shell 里传
// CESIUM_ION_TOKEN 不会生效：声明的必须是构建真正注入的那个值，声明与产物对不上就判失败。
//
// 已知边界（不谎报覆盖）：高德 Key/安全密钥没有可辨识前缀，只按「声明值精确比对」判定，
// 不做高熵启发式（产物里合法的高熵字符串太多）。因此未出现在构建期 env 里、也没被声明的第二个
// 不透明 key 无法被形态识别；这类凭据的入口收敛在 config.ts 的 define 登记（矩阵 a）与
// 「注入了就必须声明」（矩阵 b）。
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** header 与 payload 都是 base64url 编码的 JSON（以 eyJ 开头）；不限定签名算法 */
export const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
export const JWT_SHAPE_RE = /^eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
/**
 * 高德 Web 端 Key 与安全密钥的公开格式固定为 32 位十六进制。用严格形态而不是「非空」：
 * 截断的复制粘贴、带引号/空白/换行的声明都必须判失败，不能当成「已声明」。
 */
export const AMAP_VALUE_SHAPE_RE = /^[0-9a-fA-F]{32}$/;
export const MAX_LISTED_FILES = 10;

/**
 * 非 JWT 形态的常见密钥特征（审计 2026-09-22 M-5）：刻意保守，避免对 Cesium base64 资产误报。
 * 高熵启发式不做——产物内合法高熵字符串过多，误报不可控；高德 key 这类无前缀的不透明凭据
 * 走上面的「类型化声明」，不做形态猜测。
 */
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS Access Key ID'],
  [/ghp_[A-Za-z0-9]{36}/, 'GitHub PAT（ghp_）'],
  [/gho_[A-Za-z0-9]{36}/, 'GitHub OAuth token（gho_）'],
  [/github_pat_[A-Za-z0-9_]{22,}/, 'GitHub fine-grained PAT'],
  // sk- 的字符类不含 '-'，会漏掉 sk-ant-（Anthropic）这类带内嵌连字符的前缀
  [/sk-(?:ant-)?[A-Za-z0-9-]{20,}/, 'sk- 前缀 API key（含 sk-ant-）'],
  [/glpat-[A-Za-z0-9_-]{20,}/, 'GitLab PAT（glpat-）'],
  [/npm_[A-Za-z0-9]{36}/, 'npm access token（npm_）'],
  [/xox[bp]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key（AIza）'],
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, 'PEM 私钥块'],
];

/**
 * 凭据类型登记表：一类凭据 = 一个构建期 define + 一个声明变量 + 一个形态。
 * config/config.ts 的 define 块里由 process.env 注入的每个凭据都必须在此登记
 * （findEnvBackedDefines 会在每次扫描时核对，登记表与 config 漂移即失败）。
 */
export const CREDENTIAL_DECLARATIONS = Object.freeze([
  {
    type: 'cesium-ion-token',
    label: 'Cesium ion token',
    define: 'CESIUM_ION_TOKEN',
    declaration: 'EXPECTED_CESIUM_TOKEN',
    /** 仅 Cesium token 保留的废弃别名（审计 2026-09-22 H-1 的旧通道） */
    alias: 'EXPECTED_TOKEN',
    shape: JWT_SHAPE_RE,
    shapeLabel: 'JWT 形态（三段 base64url，header 以 eyJ 开头）',
  },
  {
    type: 'amap-key',
    label: '高德 Web 端 Key',
    define: 'AMAP_KEY',
    declaration: 'EXPECTED_AMAP_KEY',
    shape: AMAP_VALUE_SHAPE_RE,
    shapeLabel: '32 位十六进制',
  },
  {
    type: 'amap-security-code',
    label: '高德安全密钥',
    define: 'AMAP_SECURITY_CODE',
    declaration: 'EXPECTED_AMAP_SECURITY_CODE',
    shape: AMAP_VALUE_SHAPE_RE,
    shapeLabel: '32 位十六进制',
  },
]);

/**
 * 由 process.env 派生、但「设计上公开」的 define（不是凭据）：允许出现在公开产物里，不需要 EXPECTED_* 声明。
 * 新增条目必须写清为什么公开；凭据类的值不能放这里，应登记到 CREDENTIAL_DECLARATIONS。
 */
export const PUBLIC_ENV_DEFINES = Object.freeze({
  UMI_APP_API_BASE: '同源 API 路径前缀（config/auth.ts 校验为固定同源路径）',
  UMI_APP_DEMO_MODE: '演示模式布尔开关',
  BUILD_INFO: '构建信息（commit sha、部署目标、构建时间），与 dist/version.json 同源公开',
});

/**
 * umi 对 UMI_APP_* 前缀的环境变量无条件注入浏览器包（bundler-webpack definePlugin 的 `process.env` 对象），
 * 任何读取完整 process.env 的依赖都会把它们打进产物。只有这里登记的名字被视为公开配置。
 */
export const PUBLIC_UMI_APP_VARS = Object.freeze({
  UMI_APP_API_BASE: '同源 API 路径前缀',
  UMI_APP_DEMO_MODE: '演示模式布尔开关',
});

/** define 块里无法静态识别的条目以此前缀命名，evaluateDeclarations 一律判失败 */
const UNRECOGNIZED = '<无法识别的 define 条目>';

export const fingerprint = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);

/** 仓库内路径显示为相对路径，仓库外（如测试用临时目录）显示绝对路径 */
const display = (path) => {
  const rel = relative(root, path);
  return rel && !rel.startsWith('..') ? rel : path;
};

const fail = (message) => {
  console.error(`::error::${message}`);
  process.exit(1);
};

// ---------- config/config.ts 的 define 块解析（不引 TS 解析器：只认块结构，认不出就判失败） ----------

/** 跳过注释/字符串：返回该下标处「平凡字符」或跳转后的下标 */
const skipTrivia = (source, index) => {
  const char = source[index];
  if (char === '/' && source[index + 1] === '/') {
    const newline = source.indexOf('\n', index);
    return newline === -1 ? source.length - 1 : newline;
  }
  if (char === '/' && source[index + 1] === '*') {
    const end = source.indexOf('*/', index + 2);
    return end === -1 ? source.length - 1 : end + 1;
  }
  if (char === "'" || char === '"' || char === '`') {
    for (let cursor = index + 1; cursor < source.length; cursor += 1) {
      if (source[cursor] === '\\') {
        cursor += 1;
        continue;
      }
      if (source[cursor] === char) return cursor;
    }
    return source.length - 1;
  }
  return index;
};

/**
 * 抽出源码里 `key: { ... }` 的花括号正文（可多次出现）；结构不完整返回已抽到的部分。
 * 逐字符扫描并跳过注释与字符串：注释里写的 `define: {` 与字符串里的同名文本都不算结构。
 */
const extractObjectBlocks = (source, key) => {
  const blocks = [];
  const keyRe = new RegExp(`${key}\\s*:\\s*\\{`, 'y');
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const skipped = skipTrivia(source, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(source[cursor - 1] ?? '')) continue; // 标识符中间（如 defineConfig）
    keyRe.lastIndex = cursor;
    const matched = keyRe.exec(source);
    if (!matched) continue;
    const open = matched.index + matched[0].length - 1;
    let depth = 0;
    for (let inner = open; inner < source.length; inner += 1) {
      const innerSkipped = skipTrivia(source, inner);
      if (innerSkipped !== inner) {
        inner = innerSkipped;
        continue;
      }
      if (source[inner] === '{') depth += 1;
      else if (source[inner] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(open + 1, inner));
          break;
        }
      }
    }
  }
  return blocks;
};

/** 去掉注释但保留字符串（字符串里的 // 与 { } 都不是结构） */
const stripComments = (source) => {
  let output = '';
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '/' && source[cursor + 1] === '/') {
      const newline = source.indexOf('\n', cursor);
      if (newline === -1) break;
      output += '\n';
      cursor = newline;
      continue;
    }
    if (char === '/' && source[cursor + 1] === '*') {
      const end = source.indexOf('*/', cursor + 2);
      if (end === -1) break;
      cursor = end + 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      let end = cursor + 1;
      while (end < source.length && source[end] !== char) {
        if (source[end] === '\\') end += 1;
        end += 1;
      }
      output += source.slice(cursor, Math.min(end + 1, source.length));
      cursor = end;
      continue;
    }
    output += char;
  }
  return output;
};

/** 按顶层逗号切开对象字面量（嵌套的 {} [] () 里的逗号不算） */
const splitTopLevel = (block) => {
  const segments = [];
  let current = '';
  let depth = 0;
  const source = stripComments(block);
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '{' || char === '[' || char === '(') depth += 1;
    else if (char === '}' || char === ']' || char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      segments.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  segments.push(current);
  return segments.map((segment) => segment.trim()).filter(Boolean);
};

/** 去掉单/双引号字符串（模板字符串保留：`${process.env.X}` 是真引用）后再找 process.env */
const stripQuotedStrings = (expression) =>
  expression.replace(/'(?:\\.|[^'\\])*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');

/** 只剩代码的文本：注释与单/双引号字符串都去掉（模板字符串保留） */
const codeOf = (source) => stripQuotedStrings(stripComments(source));

/**
 * env 来源：任何对 `process` 的引用都算（process.env.X、process['env']、const { env } = process ……），
 * 宁可多判：误判只会让门禁失败并要求登记，漏判才会放过凭据。
 */
const ENV_SOURCE_RE = /\bprocess\b/;
const IDENTIFIER_RE = /[A-Za-z_$][\w$]*/g;
const referencesAny = (code, names) =>
  names.size > 0 && [...code.matchAll(IDENTIFIER_RE)].some(([name]) => names.has(name));

/** 从 open 处的括号起找到配对的闭括号（已去掉注释与字符串的代码） */
const matchingClose = (code, open) => {
  let depth = 0;
  for (let cursor = open; cursor < code.length; cursor += 1) {
    if ('([{'.includes(code[cursor])) depth += 1;
    else if (')]}'.includes(code[cursor])) {
      depth -= 1;
      if (depth === 0) return cursor;
    }
  }
  return code.length - 1;
};

/** 从 start 起到第一个顶层分号（或文件末尾）的文本：变量初始化表达式 */
const statementFrom = (code, start) => {
  let depth = 0;
  for (let cursor = start; cursor < code.length; cursor += 1) {
    const char = code[cursor];
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) {
      if (depth === 0) return code.slice(start, cursor);
      depth -= 1;
    } else if (char === ';' && depth === 0) return code.slice(start, cursor);
  }
  return code.slice(start);
};

/** 解构模式里被绑定的名字：`{ A, b: B, ...rest }` → A、B、rest（冒号左侧的属性名不算） */
const patternNames = (pattern) =>
  [...pattern.matchAll(/([A-Za-z_$][\w$]*)(\s*:(?!:))?/g)].filter((match) => !match[2]).map((match) => match[1]);

/** import / export-from 子句里出现的本地名字 */
const importClauseNames = (clause) => {
  const names = [];
  const braces = /\{([\s\S]*?)\}/.exec(clause);
  if (braces) {
    for (const part of braces[1].split(',')) {
      const match = /([A-Za-z_$][\w$]*)\s*$/.exec(part.trim().replace(/^type\s+/, ''));
      if (match) names.push(match[1]);
    }
  }
  const rest = clause.replace(/\{[\s\S]*?\}/, '');
  const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(rest);
  if (namespace) names.push(namespace[1]);
  const defaultName = /^\s*([A-Za-z_$][\w$]*)/.exec(rest.replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, ''));
  if (defaultName && defaultName[1] !== 'type') names.push(defaultName[1]);
  return names;
};

/** 源码里的 import / export ... from：[{ names, specifier }]（注释已去掉，字符串保留） */
const moduleImports = (source) =>
  [
    // 子句里不会有分号：以此为界，前面的 export 语句不会吞掉后面的 import
    ...stripComments(source).matchAll(/\b(?:import|export)\s+(?:type\s+)?([^;]*?)\s*\bfrom\s*['"]([^'"]+)['"]/g),
  ].map(([, clause, specifier]) => ({ names: importClauseNames(clause), specifier }));

/** 相对 from 模块解析出的相对路径（以 ./ 或 ../ 开头），交给 readModule 读取 */
const resolveSpecifier = (from, specifier) => {
  const joined = posix.normalize(posix.join(posix.dirname(from), specifier));
  return joined.startsWith('.') ? joined : `./${joined}`;
};

/**
 * 本地模块是否（直接或经它导入的本地模块）读取 process：是则它导出的一切都视为 env 派生。
 * 读不到源码的本地模块按「派生」处理（fail closed）；包导入（非相对路径）不追踪。
 */
const moduleReadsEnv = (path, readModule, seen = new Set()) => {
  if (seen.has(path)) return false;
  seen.add(path);
  const source = readModule(path);
  if (source === undefined) return true;
  if (ENV_SOURCE_RE.test(codeOf(source))) return true;
  return moduleImports(source).some(
    ({ specifier }) => specifier.startsWith('.') && moduleReadsEnv(resolveSpecifier(path, specifier), readModule, seen),
  );
};

/**
 * 配置文件里由 process.env 派生的标识符（不动点迭代）：变量 / 解构 / 函数声明的初始化或函数体
 * 引用了 process 或已派生的标识符；以及从读取 process 的本地模块导入的名字。
 */
export const findEnvTaintedIdentifiers = (source, { readModule = () => undefined } = {}) => {
  const tainted = new Set();
  for (const { names, specifier } of moduleImports(source)) {
    if (specifier.startsWith('.') && moduleReadsEnv(resolveSpecifier('./config.ts', specifier), readModule)) {
      names.forEach((name) => tainted.add(name));
    }
  }
  const code = codeOf(source);
  const declarations = [];
  for (const match of code.matchAll(/\b(?:const|let|var)\s+(\{[^}]*\}|\[[^\]]*\]|[A-Za-z_$][\w$]*)[^=;]*=(?!=)/g)) {
    const target = match[1];
    const names = /^[{[]/.test(target) ? patternNames(target.slice(1, -1)) : [target];
    declarations.push({ names, text: statementFrom(code, match.index + match[0].length) });
  }
  for (const match of code.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    const paramsOpen = match.index + match[0].length - 1;
    const bodyOpen = code.indexOf('{', matchingClose(code, paramsOpen));
    const end = bodyOpen === -1 ? code.length : matchingClose(code, bodyOpen);
    declarations.push({ names: [match[1]], text: code.slice(paramsOpen, end + 1) });
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const { names, text } of declarations) {
      if (names.every((name) => tainted.has(name))) continue;
      if (ENV_SOURCE_RE.test(text) || referencesAny(text, tainted)) {
        names.forEach((name) => tainted.add(name));
        changed = true;
      }
    }
  }
  return tainted;
};

/**
 * define 块的条目：{ name, expression, referencesEnv }。
 * referencesEnv：表达式引用了 process 或 env 派生的标识符（简写属性按同名标识符判定）。
 * 认不出的条目（展开 `...X`、计算属性名 `[k]: v` 等）以 UNRECOGNIZED 前缀命名并视为 env 派生——
 * 门禁无法核对它注入了什么，只能 fail closed。
 */
export const parseDefineEntries = (source, options = {}) => {
  const tainted = findEnvTaintedIdentifiers(source, options);
  const derives = (expression) => {
    const code = stripQuotedStrings(expression);
    return ENV_SOURCE_RE.test(code) || referencesAny(code, tainted);
  };
  return extractObjectBlocks(source, 'define')
    .flatMap((block) => splitTopLevel(block))
    .map((segment) => {
      const withValue = /^(?:(['"])([A-Za-z_$][\w$]*)\1|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]*)$/.exec(segment);
      if (withValue) {
        const expression = withValue[4].trim();
        return { name: withValue[2] ?? withValue[3], expression, referencesEnv: derives(expression) };
      }
      if (/^[A-Za-z_$][\w$]*$/.test(segment)) {
        return { name: segment, expression: segment, referencesEnv: tainted.has(segment) };
      }
      return { name: `${UNRECOGNIZED} ${segment.slice(0, 60)}`, expression: segment, referencesEnv: true };
    });
};

/** define 块里由 process.env 派生的 define 名（凭据登记表 + 公开配置登记必须覆盖全部） */
export const findEnvBackedDefines = (source, options = {}) =>
  parseDefineEntries(source, options)
    .filter((entry) => entry.referencesEnv)
    .map((entry) => entry.name);

/** .env 文件里定义的变量名（只取名字，不读值；与 dotenv 的 `KEY=value` / `export KEY=value` 写法一致） */
export const envFileNames = (source) =>
  source
    .split(/\r?\n/)
    .map((line) => /^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*=/.exec(line)?.[1])
    .filter(Boolean);

/**
 * umi 隐式注入通道里未登记的变量名：构建环境与 env 文件（cwd 下 .env / .env.local，umi loadEnv 的口径）
 * 里所有 UMI_APP_* 名字，减去 PUBLIC_UMI_APP_VARS。
 */
export const findImplicitEnvChannel = ({ env = process.env, envFileNames: fileNames = [] } = {}) =>
  [...new Set([...Object.keys(env).filter((name) => env[name] !== undefined), ...fileNames])].filter(
    (name) => /^UMI_APP_/.test(name) && !Object.hasOwn(PUBLIC_UMI_APP_VARS, name),
  );

/**
 * 声明校验（静态部分）：登记表 ↔ define 块漂移、形态、未声明、声明与 define 不一致。
 * 返回 { failures, warnings, entries }，entries 里带 valid（形态合法且非空）与 declared/defineValue。
 */
export const evaluateDeclarations = ({ env = process.env, envBackedDefines = [] } = {}) => {
  const failures = [];
  const warnings = [];
  const registeredDefines = new Set(CREDENTIAL_DECLARATIONS.map((entry) => entry.define));
  const envBacked = new Set(envBackedDefines);

  for (const name of envBacked) {
    if (name.startsWith(UNRECOGNIZED)) {
      failures.push(
        `config 的 define 块里有无法静态识别的条目（${name.slice(UNRECOGNIZED.length).trim()}）：` +
          `展开、计算属性名等写法无法核对是否注入了凭据，请改成「NAME: 值」的显式条目`,
      );
    } else if (!registeredDefines.has(name) && !Object.hasOwn(PUBLIC_ENV_DEFINES, name)) {
      failures.push(
        `config 的 define 块里 ${name} 由 process.env（直接或间接）派生，但扫描器登记表` +
          `（CREDENTIAL_DECLARATIONS / PUBLIC_ENV_DEFINES）没有它：新增/改名凭据必须同步登记，` +
          `否则该凭据无法声明与校验；确属公开配置则登记到 PUBLIC_ENV_DEFINES 并写明理由`,
      );
    }
  }

  const entries = CREDENTIAL_DECLARATIONS.map((declaration) => {
    if (!envBacked.has(declaration.define)) {
      failures.push(
        `config 的 define 块里找不到 process.env.${declaration.define}：登记表与 define 块已漂移，请同步后再扫描`,
      );
    }
    const defineValue = env[declaration.define] ?? '';
    let declared = env[declaration.declaration] ?? '';
    const aliasValue = declaration.alias ? (env[declaration.alias] ?? '') : '';
    if (aliasValue) {
      warnings.push(
        `${declaration.alias} 已废弃：仅保留为 ${declaration.label} 的旧别名，请改用 ${declaration.declaration}`,
      );
      if (declared && declared !== aliasValue) {
        failures.push(`${declaration.alias} 与 ${declaration.declaration} 同时设置且不一致：无法判定以哪个声明为准`);
      } else {
        declared = aliasValue;
      }
    }
    if (defineValue && !declaration.shape.test(defineValue)) {
      failures.push(
        `构建期 ${declaration.define} 非空但不是预期形态（${declaration.shapeLabel}）：` +
          `截断/带空白的值无法校验，判失败`,
      );
    }
    if (declared && !declaration.shape.test(declared)) {
      failures.push(
        `${declaration.declaration} 已设置但不是预期形态（${declaration.shapeLabel}）：疑似拼写残缺，判失败`,
      );
    }
    if (defineValue && !declared) {
      failures.push(
        `${declaration.define} 在构建期已配置但未声明 ${declaration.declaration}：` +
          `凭据注入产物前必须显式声明「设计上公开」——把同名凭据同时传给构建与扫描，` +
          `并为本类凭据设置 ${declaration.declaration}（Vercel 项目环境变量 / Docker --build-arg / CI env）`,
      );
    }
    if (defineValue && declared && defineValue !== declared) {
      failures.push(
        `${declaration.declaration} 与构建期 ${declaration.define} 不一致` +
          `（声明指纹 ${fingerprint(declared)}，构建指纹 ${fingerprint(defineValue)}）：` +
          `声明必须与构建实际注入的值完全一致`,
      );
    }
    return {
      ...declaration,
      defineValue,
      declared,
      valid: Boolean(declared) && declaration.shape.test(declared),
    };
  });

  return { failures, warnings, entries };
};

// ---------- 扫描产物 ----------

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

/** 扫描产物：JWT 白名单（Cesium 默认 + 已声明值）、已声明的不透明凭据、固定密钥形态。
 * allowedValues: Map<值, 声明条目>；cesiumDefaultToken: Cesium 源码里的公开默认 token。
 */
export const scanArtifact = (distDir, { allowedValues = new Map(), cesiumDefaultToken = '' } = {}) => {
  const files = walk(distDir);
  /** 指纹 → { label, files:Set, declaration? } */
  const allowed = new Map();
  const unexpected = new Map();
  const nonJwtHits = new Map();
  /** 声明值 → 出现文件集合（用于「声明必须有对应产物值」） */
  const foundValues = new Map();
  /** 指纹 → 文件集合（非白名单 JWT、密钥特征这类无描述的桶） */
  const addToSetMap = (map, key, file) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(file);
  };
  /** 指纹 → { label, files, declaration }（放行凭据的描述桶） */
  const addToGroupMap = (map, key, file, create) => {
    if (!map.has(key)) map.set(key, create());
    map.get(key).files.add(file);
  };

  for (const file of files) {
    const content = readFileSync(file, 'latin1');
    const rel = relative(distDir, file);
    for (const [token] of content.matchAll(JWT_RE)) {
      if (token === cesiumDefaultToken) {
        addToGroupMap(allowed, fingerprint(token), rel, () => ({
          label: 'Cesium 源码自带的公开默认 ion token（无需声明）',
          files: new Set(),
          declaration: '',
        }));
      } else if (allowedValues.has(token)) {
        const entry = allowedValues.get(token);
        addToGroupMap(allowed, fingerprint(token), rel, () => ({
          label: `${entry.label} ← ${entry.declaration}`,
          files: new Set(),
          declaration: entry.declaration,
        }));
      } else {
        addToSetMap(unexpected, fingerprint(token), rel);
      }
    }
    for (const [value, entry] of allowedValues) {
      // JWT 形态的值已在上面的 matchAll 里统计，这里只处理不透明凭据
      if (entry.shape === JWT_SHAPE_RE) continue;
      if (!content.includes(value)) continue;
      addToGroupMap(allowed, fingerprint(value), rel, () => ({
        label: `${entry.label} ← ${entry.declaration}`,
        files: new Set(),
        declaration: entry.declaration,
      }));
      if (!foundValues.has(value)) foundValues.set(value, new Set());
      foundValues.get(value).add(rel);
    }
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(content)) addToSetMap(nonJwtHits, label, rel);
    }
  }

  // JWT 声明的产物存在性：JWT 命中的文件集合即证据
  for (const [value, entry] of allowedValues) {
    if (entry.shape !== JWT_SHAPE_RE) continue;
    const group = allowed.get(fingerprint(value));
    if (group) foundValues.set(value, new Set(group.files));
  }

  return { files, allowed, unexpected, nonJwtHits, foundValues };
};

const printGroup = (key, fileSet, prefix = '  指纹') => {
  const list = [...fileSet].sort();
  console.log(`${prefix} ${key}：${list.length} 个文件`);
  for (const file of list.slice(0, MAX_LISTED_FILES)) console.log(`    ${file}`);
  if (list.length > MAX_LISTED_FILES) console.log(`    …另 ${list.length - MAX_LISTED_FILES} 个`);
};

const main = () => {
  const distDir = resolve(root, process.argv[2] ?? 'dist');
  if (!existsSync(distDir)) fail(`${display(distDir)} 不存在，请先构建`);

  const configPath = resolve(root, 'config/config.ts');
  if (!existsSync(configPath)) fail(`找不到 ${display(configPath)}：无法核对凭据定义来源，判失败`);
  // UMI_ENV=github 时 config.github.ts 的 define 与主配置逐键合并：两份都要核对
  const configPaths = [configPath, resolve(root, 'config/config.github.ts')].filter((path) => existsSync(path));
  const readModule = (specifier) => {
    for (const suffix of ['', '.ts', '.mts', '.js', '.mjs', '/index.ts']) {
      const path = resolve(root, 'config', `${specifier}${suffix}`);
      if (existsSync(path) && !statSync(path).isDirectory()) return readFileSync(path, 'utf8');
    }
    return undefined;
  };
  const envBackedDefines = [
    ...new Set(configPaths.flatMap((path) => findEnvBackedDefines(readFileSync(path, 'utf8'), { readModule }))),
  ];
  const { failures, warnings, entries } = evaluateDeclarations({ env: process.env, envBackedDefines });
  // umi loadEnv 读的是构建进程 cwd 下的 .env / .env.local；扫描进程按同一 cwd 读取，只取变量名
  const fileNames = ['.env', '.env.local'].flatMap((file) => {
    const path = resolve(process.cwd(), file);
    return existsSync(path) ? envFileNames(readFileSync(path, 'utf8')) : [];
  });
  for (const name of findImplicitEnvChannel({ env: process.env, envFileNames: fileNames })) {
    failures.push(
      `${name} 未登记为公开配置：umi 会把构建环境（含 cwd 下 .env / .env.local）里所有 UMI_APP_* 变量` +
        `注入浏览器包的 process.env 对象，不经过 define 块也会进产物。凭据不得使用 UMI_APP_ 前缀；` +
        `确属公开配置请登记到 PUBLIC_UMI_APP_VARS`,
    );
  }
  for (const warning of warnings) console.warn(`⚠️ ${warning}`);
  if (failures.length) {
    for (const message of failures) console.error(`  ✗ ${message}`);
    fail(`凭据声明校验未通过（${failures.length} 项）：未声明/形态不合法/与构建期 define 不一致都不放行`);
  }

  // ---- 白名单：Cesium 自带的公开默认 token ----
  /** @cesium/engine 是 cesium 的依赖而非项目直接依赖：从 cesium 包的位置解析，不依赖 node_modules 提升 */
  let ionSourcePath = 'node_modules/cesium → @cesium/engine/Source/Core/Ion.js';
  let cesiumDefaultToken;
  try {
    const requireFromCesium = createRequire(createRequire(import.meta.url).resolve('cesium/package.json'));
    ionSourcePath = join(dirname(requireFromCesium.resolve('@cesium/engine/package.json')), 'Source/Core/Ion.js');
    cesiumDefaultToken = /defaultAccessToken\s*=\s*["'`]([^"'`]+)["'`]/.exec(readFileSync(ionSourcePath, 'utf8'))?.[1];
  } catch {
    // 文件缺失与内容不符合预期统一在下方判失败
  }
  if (!cesiumDefaultToken || !JWT_SHAPE_RE.test(cesiumDefaultToken)) {
    fail(`无法从 ${display(ionSourcePath)} 读取 Cesium 默认 token，白名单失效（Cesium 升级后源码结构是否变化？）`);
  }

  const allowedValues = new Map();
  for (const entry of entries) {
    if (entry.valid) allowedValues.set(entry.declared, entry);
  }

  const result = scanArtifact(distDir, { allowedValues, cesiumDefaultToken });

  console.log(
    `产物凭据扫描：${display(distDir)}，共 ${result.files.length} 个文件；` +
      `登记 ${CREDENTIAL_DECLARATIONS.length} 类凭据，定义来源 ${display(configPath)} 的 define 块`,
  );
  for (const entry of entries) {
    const state = entry.valid ? '已声明' : entry.defineValue ? '构建期已配置但未声明' : '未配置（无声明）';
    console.log(
      `  凭据类型 ${entry.type}：${entry.define} → ${entry.declaration} ${state}` +
        (entry.valid ? `，指纹 ${fingerprint(entry.declared)}` : ''),
    );
  }

  // 「声明必须有对应产物值」：声明了却没扫到，说明扫描的产物不是这份声明对应的构建
  const missingValues = entries.filter((entry) => entry.valid && !result.foundValues.has(entry.declared));
  if (result.allowed.size) {
    console.log('放行凭据（只列 sha256 指纹与文件，不含值）：');
    for (const [key, group] of result.allowed) printGroup(key, group.files, `  ${group.label}｜指纹`);
  }
  if (result.nonJwtHits.size) {
    console.log('非 JWT 形态密钥特征：');
    for (const [label, fileSet] of result.nonJwtHits) printGroup(label, fileSet, '  特征');
  }
  if (result.unexpected.size) {
    console.log('非白名单 JWT：');
    for (const [key, fileSet] of result.unexpected) printGroup(key, fileSet, '  指纹');
  }
  for (const entry of missingValues) {
    console.error(
      `  ✗ ${entry.declaration} 声明的值未在产物中出现（指纹 ${fingerprint(entry.declared)}）：` +
        `声明必须有对应产物值——扫描对象与发布对象可能不是同一份构建`,
    );
  }
  if (missingValues.length || result.unexpected.size || result.nonJwtHits.size) {
    fail(
      `产物中发现 ${missingValues.length} 项「声明无对应产物值」、` +
        `${result.unexpected.size} 个非白名单 JWT 与 ${result.nonJwtHits.size} 类密钥形态特征，` +
        `疑似 secret 被硬编码进源码/依赖或经构建意外注入（上方只列指纹与文件，不含值）`,
    );
  }
  console.log('✅ 未发现白名单以外的 JWT 或密钥形态特征，且所有声明都有对应的产物值');
};

/** 只有直接执行（node scripts/check-dist-secrets.mjs）才跑主流程，被测试 import 时不执行 */
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
