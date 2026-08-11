import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaMariaDb({
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: process.env.DATABASE_PASSWORD,
      database: 'sistema007',
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
