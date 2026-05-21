import { runMonthlyLeaveCredit } from './src/jobs/leaveCredits';
runMonthlyLeaveCredit().then(() => {
  console.log("Cron run finished");
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
