// 路由配置 https://umijs.org/docs/guides/routes
// 信息架构：工作台 / 系统管理 / 设备运维 / 地图 / 组件 / 多媒体 / 文档 / 异常页。
// 路径统一小写 kebab-case；旧版路径见文件末尾 LEGACY_REDIRECTS（外链与书签不失效，由 routes.test.ts 把关）。

type RouteItem = {
  path: string;
  name?: string;
  icon?: string;
  component?: string;
  redirect?: string;
  access?: string;
  layout?: boolean;
  hideInMenu?: boolean;
  routes?: RouteItem[];
};

/** 旧路径 → 新路径（2026-09 信息架构调整前的全部可访问路径） */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/home': '/dashboard',
  '/table': '/system/users',
  '/access': '/system/access',
  '/feature': '/components/calendar',
  '/feature/fullCalendar': '/components/calendar',
  '/feature/RichTextEditing': '/components/rich-text',
  '/feature/DndKit': '/ops/tickets',
  '/feature/Signature': '/components/signature',
  '/feature/Html2Canvas': '/components/screenshot',
  '/feature/VideoPlayer': '/media/video',
  '/feature/VideoPlayer/xgplayer': '/media/video',
  '/feature/D3': '/ops/spectrum',
  '/feature/D3/Frequency': '/ops/spectrum',
  '/feature/AudioFeature': '/media/audio-player',
  '/feature/AudioFeature/AudioPlayer': '/media/audio-player',
  '/feature/AudioFeature/AudioVisible': '/media/audio-waveform',
  '/feature/Map': '/map/amap',
  '/feature/Map/AutonaviMap': '/map/amap',
  '/feature/Cesium': '/map/cesium/geohash',
  '/feature/Cesium/geoHash': '/map/cesium/geohash',
  '/feature/Cesium/DirectionDistance': '/map/cesium/direction',
  '/feature/Cesium/ThermalMap': '/map/cesium/heatmap',
  '/feature/Cesium/Trajectory': '/map/cesium/trajectory',
  '/feature/Cesium/Unit': '/map/cesium/select',
  '/feature/Cesium/HaiAirPosture': '/map/cesium/situation',
  '/feature/OpenLayers': '/map/openlayers',
  '/feature/OpenLayers/InfoMap': '/map/openlayers',
  '/Office': '/document/pdf',
  '/Office/pdf': '/document/pdf',
  '/Office/excel': '/document/excel',
  '/403': '/exception/403',
  '/404': '/exception/404',
};

export const routes: RouteItem[] = [
  { path: '/', redirect: '/dashboard' },
  {
    name: 'login',
    path: '/login',
    component: './Login',
    hideInMenu: true,
    // 登录页按全屏独立页设计，脱离 ProLayout 管理框架外壳
    layout: false,
  },
  { name: 'dashboard', path: '/dashboard', icon: 'DashboardOutlined', component: './Dashboard' },
  {
    name: 'system',
    path: '/system',
    icon: 'SettingOutlined',
    routes: [
      { path: '/system', redirect: '/system/users' },
      {
        name: 'users',
        path: '/system/users',
        icon: 'TeamOutlined',
        component: './System/Users',
        access: 'canSeeAdmin',
      },
      {
        name: 'roles',
        path: '/system/roles',
        icon: 'KeyOutlined',
        component: './System/Roles',
        access: 'canSeeAdmin',
      },
      {
        name: 'logs',
        path: '/system/logs',
        icon: 'FileSearchOutlined',
        component: './System/Logs',
        access: 'canSeeAdmin',
      },
      { name: 'access', path: '/system/access', icon: 'SafetyCertificateOutlined', component: './System/Access' },
    ],
  },
  {
    name: 'ops',
    path: '/ops',
    icon: 'ClusterOutlined',
    routes: [
      { path: '/ops', redirect: '/ops/devices' },
      { name: 'devices', path: '/ops/devices', icon: 'HddOutlined', component: './Ops/Devices' },
      { name: 'alarms', path: '/ops/alarms', icon: 'AlertOutlined', component: './Ops/Alarms' },
      { name: 'tickets', path: '/ops/tickets', icon: 'ProjectOutlined', component: './Ops/Tickets' },
      { name: 'spectrum', path: '/ops/spectrum', icon: 'BarChartOutlined', component: './Ops/Spectrum' },
    ],
  },
  {
    name: 'map',
    path: '/map',
    icon: 'GlobalOutlined',
    routes: [
      { path: '/map', redirect: '/map/amap' },
      { name: 'amap', path: '/map/amap', icon: 'EnvironmentOutlined', component: './Map/Amap' },
      { name: 'openlayers', path: '/map/openlayers', icon: 'CompassOutlined', component: './Map/OpenLayers' },
      {
        name: 'cesium',
        path: '/map/cesium',
        icon: 'DeploymentUnitOutlined',
        routes: [
          { path: '/map/cesium', redirect: '/map/cesium/geohash' },
          { name: 'geohash', path: '/map/cesium/geohash', component: './Map/Cesium/GeoHash' },
          { name: 'direction', path: '/map/cesium/direction', component: './Map/Cesium/Direction' },
          { name: 'heatmap', path: '/map/cesium/heatmap', component: './Map/Cesium/Heatmap' },
          { name: 'trajectory', path: '/map/cesium/trajectory', component: './Map/Cesium/Trajectory' },
          { name: 'select', path: '/map/cesium/select', component: './Map/Cesium/BoxSelect' },
          { name: 'situation', path: '/map/cesium/situation', component: './Map/Cesium/Situation' },
        ],
      },
    ],
  },
  {
    name: 'components',
    path: '/components',
    icon: 'AppstoreOutlined',
    routes: [
      { path: '/components', redirect: '/components/calendar' },
      { name: 'calendar', path: '/components/calendar', icon: 'CalendarOutlined', component: './Components/Calendar' },
      { name: 'richText', path: '/components/rich-text', icon: 'FileTextOutlined', component: './Components/RichText' },
      { name: 'signature', path: '/components/signature', icon: 'EditOutlined', component: './Components/Signature' },
      {
        name: 'screenshot',
        path: '/components/screenshot',
        icon: 'ScissorOutlined',
        component: './Components/Screenshot',
      },
    ],
  },
  {
    name: 'media',
    path: '/media',
    icon: 'PlayCircleOutlined',
    routes: [
      { path: '/media', redirect: '/media/video' },
      { name: 'video', path: '/media/video', icon: 'VideoCameraOutlined', component: './Media/Video' },
      {
        name: 'audioPlayer',
        path: '/media/audio-player',
        icon: 'CustomerServiceOutlined',
        component: './Media/AudioPlayer',
      },
      {
        name: 'audioWaveform',
        path: '/media/audio-waveform',
        icon: 'AudioOutlined',
        component: './Media/AudioWaveform',
      },
    ],
  },
  {
    name: 'document',
    path: '/document',
    icon: 'FolderOpenOutlined',
    routes: [
      { path: '/document', redirect: '/document/pdf' },
      { name: 'pdf', path: '/document/pdf', icon: 'FilePdfOutlined', component: './Document/Pdf' },
      { name: 'excel', path: '/document/excel', icon: 'FileExcelOutlined', component: './Document/Excel' },
    ],
  },
  {
    name: 'exception',
    path: '/exception',
    icon: 'WarningOutlined',
    routes: [
      { path: '/exception', redirect: '/exception/403' },
      { name: '403', path: '/exception/403', component: './Exception/403' },
      { name: '404', path: '/exception/404', component: './Exception/404' },
      { name: '500', path: '/exception/500', component: './Exception/500' },
    ],
  },
  ...Object.entries(LEGACY_REDIRECTS).map(([path, redirect]) => ({ path, redirect })),
  { path: '*', name: 'notFound', component: './Exception/404', hideInMenu: true },
];
