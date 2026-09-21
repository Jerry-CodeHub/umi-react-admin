// 用于配置路由的文件
// https://umijs.org/docs/guides/routes

export const routes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    name: 'home',
    path: '/home',
    icon: 'HomeFilled',
    component: './Home',
  },
  {
    name: 'login',
    path: '/login',
    component: './Login',
    hideInMenu: true,
    // 登录页按全屏独立页设计，脱离 ProLayout 管理框架外壳
    layout: false,
  },
  {
    name: 'access',
    path: '/access',
    icon: 'LockOutlined',
    component: './Access',
    access: 'canSeeAdmin',
  },
  {
    name: 'table',
    path: '/table',
    icon: 'TableOutlined',
    component: './Table',
    access: 'canSeeAdmin',
  },
  {
    name: 'feature',
    path: '/feature',
    icon: 'ToolFilled',
    routes: [
      {
        name: 'feature',
        path: '/feature',
        hideInMenu: true,
        component: './Feature/FullCalendar',
      },
      {
        name: 'fullCalendar',
        path: '/feature/fullCalendar',
        component: './Feature/FullCalendar',
        icon: 'CalendarOutlined',
      },
      {
        name: 'RichTextEditing',
        path: '/feature/RichTextEditing',
        component: './Feature/RichTextEditing',
        icon: 'FileTextOutlined',
      },
      {
        name: 'DndKit',
        path: '/feature/DndKit',
        component: './Feature/DndKit',
        icon: 'BlockOutlined',
      },
      {
        name: 'Signature',
        path: '/feature/Signature',
        component: './Feature/Signature',
        icon: 'EditOutlined',
      },
      {
        name: 'Html2Canvas',
        path: '/feature/Html2Canvas',
        component: './Feature/Html2Canvas',
        icon: 'ScissorOutlined',
      },
      {
        name: 'VideoPlayer',
        path: '/feature/VideoPlayer',
        icon: 'VideoCameraAddOutlined',
        routes: [
          {
            name: 'xgplayer',
            path: '/feature/VideoPlayer/xgplayer',
            component: './Feature/VideoPlayer/xgplayer',
          },
        ],
      },
      {
        name: 'D3',
        path: '/feature/D3',
        icon: 'DotChartOutlined',
        routes: [
          {
            name: 'Frequency',
            path: '/feature/D3/Frequency',
            component: './Feature/D3/Frequency',
          },
        ],
      },
      {
        name: 'AudioFeature',
        path: '/feature/AudioFeature',
        icon: 'CustomerServiceOutlined',
        routes: [
          {
            name: 'AudioPlayer',
            path: '/feature/AudioFeature/AudioPlayer',
            component: './Feature/AudioFeature/AudioPlayer',
          },
          {
            name: 'AudioVisible',
            path: '/feature/AudioFeature/AudioVisible',
            component: './Feature/AudioFeature/AudioVisible',
          },
        ],
      },
      {
        name: 'Map',
        path: '/feature/Map',
        icon: 'HeatMapOutlined',
        routes: [
          {
            name: 'AutonaviMap',
            path: '/feature/Map/AutonaviMap',
            component: './Feature/Map/AutonaviMap',
          },
        ],
      },
      {
        name: 'Cesium',
        path: '/feature/Cesium',
        icon: 'DeploymentUnitOutlined',
        routes: [
          {
            name: 'geoHash',
            path: '/feature/Cesium/geoHash',
            component: './Feature/Map/Cesium/GeoHash',
          },
          {
            name: 'DirectionDistance',
            path: '/feature/Cesium/DirectionDistance',
            component: './Feature/Map/Cesium/DirectionDistance',
          },
          {
            name: 'ThermalMap',
            path: '/feature/Cesium/ThermalMap',
            component: './Feature/Map/Cesium/ThermalMap',
          },
          {
            name: 'Trajectory',
            path: '/feature/Cesium/Trajectory',
            component: './Feature/Map/Cesium/Trajectory',
          },
          {
            name: 'Unit',
            path: '/feature/Cesium/Unit',
            component: './Feature/Map/Cesium/Unit',
          },
          {
            name: 'HaiAirPosture',
            path: '/feature/Cesium/HaiAirPosture',
            component: './Feature/Map/Cesium/HaiAirPosture',
          },
        ],
      },
      {
        name: 'OpenLayers',
        path: '/feature/OpenLayers',
        icon: 'GlobalOutlined',
        routes: [
          {
            name: 'InfoMap',
            path: '/feature/OpenLayers/InfoMap',
            component: './Feature/Map/OpenLayers/InfoMap',
          },
        ],
      },
    ],
  },
  { path: '/feature/Map', redirect: '/feature/Map/AutonaviMap' },
  { path: '/feature/Cesium', redirect: '/feature/Cesium/geoHash' },
  { path: '/feature/D3', redirect: '/feature/D3/Frequency' },
  { path: '/feature/AudioFeature', redirect: '/feature/AudioFeature/AudioPlayer' },
  { path: '/feature/VideoPlayer', redirect: '/feature/VideoPlayer/xgplayer' },
  { path: '/feature/OpenLayers', redirect: '/feature/OpenLayers/InfoMap' },
  {
    name: 'Office',
    path: '/Office',
    icon: 'ExperimentFilled',
    routes: [
      {
        name: 'Office',
        path: '/Office',
        hideInMenu: true,
        component: './Office/index',
      },
      {
        name: 'pdf',
        path: '/Office/pdf',
        component: './Office/Pdf',
        icon: 'FilePdfOutlined',
      },
      {
        name: 'excel',
        path: '/Office/excel',
        component: './Office/Excel',
        icon: 'FileExcelOutlined',
      },
    ],
  },
  {
    path: '/403',
    name: 'NotAccessible',
    component: '@/pages/403',
    hideInMenu: true,
  },
  {
    path: '*',
    name: 'NotFound',
    component: '@/pages/404',
    hideInMenu: true,
  },
];
