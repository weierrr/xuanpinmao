import { PrismaClient } from "@prisma/client";
import { exportRunReports } from "../src/infrastructure/report-export";

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  const result = await exportRunReports(prisma, "T21-full-20260714");
  console.log(JSON.stringify(result, null, 2));
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
