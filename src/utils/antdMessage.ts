import { message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

/**
 * message 实例桥：应用挂载后由 MessageBridge（app.tsx childrenRender 内）
 * 注册 antd App 上下文中的实例，使全局错误提示受 appConfig.maxCount 约束；
 * 注册前（极早期）回退到静态 message。
 */
let instance: MessageInstance | undefined;

export const registerMessage = (messageApi: MessageInstance) => {
  instance = messageApi;
};

export const getMessage = (): MessageInstance => instance ?? staticMessage;
