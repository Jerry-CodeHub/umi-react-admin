// English messages, split by domain under ./en-US/. Keys must match zh-CN exactly (checked by locales.test.ts)
import components from './en-US/components';
import dashboard from './en-US/dashboard';
import enums from './en-US/enums';
import framework from './en-US/framework';
import menu from './en-US/menu';
import ops from './en-US/ops';
import pages from './en-US/pages';
import system from './en-US/system';

export default { ...menu, ...framework, ...enums, ...pages, ...dashboard, ...components, ...system, ...ops };
