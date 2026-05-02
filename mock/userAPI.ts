let users = [
  { id: '0', name: 'Umi', nickName: 'U', gender: 'MALE', email: 'umi@example.com' },
  { id: '1', name: 'Fish', nickName: 'B', gender: 'FEMALE', email: 'fish@example.com' },
];

export default {
  'GET /api/v1/queryUserList': (req: any, res: any) => {
    const { current = 1, pageSize = 20, keyword } = req.query || {};
    const list = keyword
      ? users.filter((user) => user.name.includes(keyword) || user.nickName.includes(keyword))
      : users;
    const start = (Number(current) - 1) * Number(pageSize);
    const end = start + Number(pageSize);

    res.json({
      success: true,
      data: {
        current: Number(current),
        pageSize: Number(pageSize),
        total: list.length,
        list: list.slice(start, end),
      },
      errorCode: 0,
    });
  },
  'POST /api/v1/user': (req: any, res: any) => {
    const user = {
      id: `${Date.now()}`,
      gender: 'MALE',
      ...req.body,
    };
    users = [user, ...users];
    res.json({
      success: true,
      data: user,
      errorCode: 0,
    });
  },
  'PUT /api/v1/user/:userId': (req: any, res: any) => {
    const { userId } = req.params;
    const index = users.findIndex((user) => user.id === userId);
    if (index < 0) {
      res.status(404).json({
        success: false,
        errorCode: 404,
        message: '用户不存在',
      });
      return;
    }

    users[index] = {
      ...users[index],
      ...req.body,
    };
    res.json({
      success: true,
      data: users[index],
      errorCode: 0,
    });
  },
  'DELETE /api/v1/user/:userId': (req: any, res: any) => {
    const { userId } = req.params;
    users = users.filter((user) => user.id !== userId);
    res.json({
      success: true,
      data: userId,
      errorCode: 0,
    });
  },
};
