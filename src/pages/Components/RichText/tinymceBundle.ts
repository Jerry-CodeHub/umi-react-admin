/**
 * 自托管 TinyMCE 的打包入口（官方 "Bundling TinyMCE" 方式）：核心、模型、主题、图标、皮肤与插件
 * 全部随富文本路由的异步 chunk 分发，不访问 Tiny Cloud、不需要 API key。
 * 许可：TinyMCE 8 为 GPL-2.0-or-later（编辑器上以 licenseKey="gpl" 声明），见 THIRD-PARTY-NOTICES.md。
 * 顺序要求：tinymce 核心必须最先导入，其余模块都依赖它挂到全局的 tinymce 对象。
 */
import 'tinymce';

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

// 插件：与 RichTextEditing/index.tsx 中的 plugins 配置一一对应
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/anchor';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/charmap';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/help';
import 'tinymce/plugins/help/js/i18n/keynav/en.js';
import 'tinymce/plugins/image';
import 'tinymce/plugins/insertdatetime';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/media';
import 'tinymce/plugins/preview';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/table';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/wordcount';
