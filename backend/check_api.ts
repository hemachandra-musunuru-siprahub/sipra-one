import { getPaidLeaveBalance } from './src/services/leave/repo';
getPaidLeaveBalance('e6f1d021-0116-487c-bc76-52d1a71b9333', 2026).then(res => { console.log(res); process.exit(0); });
