import "reflect-metadata";
import { DataSource } from 'typeorm';
import { envs } from './src/config/envs';
import { ModerationLog } from './src/data/postgres/models/ModerationLog';
import { User } from './src/data/postgres/models/user.model';
import { Post } from './src/data/postgres/models/post.model';
import { Storie } from './src/data/postgres/models/stories.model';

const AppDataSource = new DataSource({
    type: "postgres",
    url: envs.POSTGRES_URL,
    entities: [ModerationLog, User, Post, Storie],
    synchronize: false,
});

AppDataSource.initialize().then(async () => {
    const logs = await ModerationLog.find({ relations: ["user"] });
    console.log("LOGS IN DB:", JSON.stringify(logs, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
