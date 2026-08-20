import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import { getDatabaseConfig } from '../config/database.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const databaseConfig = getDatabaseConfig();
    const adapter = new PrismaMariaDb({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
