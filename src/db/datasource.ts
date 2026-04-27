import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { AppliedJob } from './entities/applied-job.entity';
import { CollectedJob } from './entities/collected-job.entity';
import { BaselineSchema1745718000001 } from './migrations/1745718000001-BaselineSchema';
import { AddLastNotifTime1745718000002 } from './migrations/1745718000002-AddLastNotifTime';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: 'chuipo.db',
  entities: [User, AppliedJob, CollectedJob],
  migrations: [BaselineSchema1745718000001, AddLastNotifTime1745718000002],
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false,
  synchronize: false,
  logging: false,
});

export default AppDataSource;
