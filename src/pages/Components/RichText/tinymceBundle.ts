/**
 * 自托管 TinyMCE 的打包入口（官方 "Bundling TinyMCE" 方式）：核心、模型、主题、图标、皮肤、插件
 * 与中文语言包全部随富文本路由的异步 chunk 分发，不访问 Tiny Cloud、不需要 API key。
 * 许可：TinyMCE 8 为 GPL-2.0-or-later（编辑器上以 licenseKey="gpl" 声明），见 THIRD-PARTY-NOTICES.md。
 * 顺序要求：tinymce 核心必须最先导入，其余模块都依赖它挂到全局的 tinymce 对象。
 */
import zhComponents from '@/locales/zh-CN/components';
import tinymce from 'tinymce';

import 'tinymce/icons/default';
import 'tinymce/models/dom';
import 'tinymce/themes/silver';

// 皮肤（亮/暗两套，随全局主题切换）与编辑区内容样式：.js 版本会注册进 tinymce.Resource，无需额外请求
import 'tinymce/skins/content/dark/content.js';
import 'tinymce/skins/content/default/content.js';
import 'tinymce/skins/ui/oxide-dark/content.js';
import 'tinymce/skins/ui/oxide-dark/skin.js';
import 'tinymce/skins/ui/oxide/content.js';
import 'tinymce/skins/ui/oxide/skin.js';

// 插件：与 RichText/index.tsx 中的 plugins 配置一一对应（没用到的插件不打包）
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/charmap';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/table';
import 'tinymce/plugins/wordcount';

// 中文语言包（Tiny 官方社区语言包，经 tinymce-i18n 分发）：以 addI18n 注册，编辑器设 language: 'zh-CN'
// 时直接使用、不会再去请求 langs/zh-CN.js
import 'tinymce-i18n/langs8/zh-CN';

// 社区译法个别不妥（Undo 译作「恢复」，与「重做」难以区分），以项目文案为准
tinymce.addI18n('zh-CN', { Undo: zhComponents['richText.tinymce.undo'] });
