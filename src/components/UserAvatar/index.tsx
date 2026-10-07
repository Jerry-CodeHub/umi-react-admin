import { avatarColor, avatarText } from '@/utils/avatar';
import { Avatar, Typography } from 'antd';

type UserAvatarProps = {
  name: string;
  /** 名字下方的次要信息（登录名、邮箱……） */
  description?: string;
  size?: number;
  onClick?: () => void;
};

/** 头像 + 姓名（+ 次要信息）；头像由姓名生成首字与固定底色，不依赖外部图片 */
export default function UserAvatar({ name, description, size = 32, onClick }: UserAvatarProps) {
  const content = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar size={size} style={{ backgroundColor: avatarColor(name), flexShrink: 0 }}>
        {avatarText(name)}
      </Avatar>
      <span className="min-w-0 leading-tight">
        <span className="block truncate">{name}</span>
        {description && (
          <Typography.Text type="secondary" className="block truncate text-xs">
            {description}
          </Typography.Text>
        )}
      </span>
    </span>
  );
  return onClick ? (
    <button
      type="button"
      className="cursor-pointer border-0 bg-transparent p-0 text-left text-inherit"
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    content
  );
}
