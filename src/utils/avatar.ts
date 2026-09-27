/** 头像底色：按名字哈希取固定色（同一个人在各处颜色一致，深浅主题下都有足够对比度） */
const AVATAR_COLORS = ['#1677ff', '#13a8a8', '#722ed1', '#c41d7f', '#d46b08', '#389e0d', '#2f54eb', '#d4380d'];

export const avatarColor = (name: string) => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

/** 头像文字：中文取姓，英文取首字母 */
export const avatarText = (name: string) => (/^[a-z]/i.test(name) ? name.slice(0, 1).toUpperCase() : name.slice(0, 1));
