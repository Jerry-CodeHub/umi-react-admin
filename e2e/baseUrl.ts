/**
 * 本地静态服务器的默认地址：playwright.config（webServer.url/baseURL）与 e2e/fixtures
 * （navigate/version 探测）必须指向同一处——此前两处各写一份字面量，改端口会静默分叉。
 */
export const DEFAULT_BASE_URL = 'http://localhost:4173/umi-react-admin/';
