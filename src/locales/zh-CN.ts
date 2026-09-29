// 中文文案，按领域拆分在 ./zh-CN/ 下；键名约定见各模块头注释。en-US 必须与本文件键集一致（locales.test.ts 把关）
import components from './zh-CN/components';
import dashboard from './zh-CN/dashboard';
import enums from './zh-CN/enums';
import framework from './zh-CN/framework';
import menu from './zh-CN/menu';
import pages from './zh-CN/pages';
import system from './zh-CN/system';

export default { ...menu, ...framework, ...enums, ...pages, ...dashboard, ...components, ...system };
