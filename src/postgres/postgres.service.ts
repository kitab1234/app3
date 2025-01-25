import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'src/logger/logger.service';
import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private pool: Pool;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: Logger
  ) {
    this.loggerService.log(this.configService.get<string>('POSTGRES_USER'))
    this.loggerService.log(this.configService.get<string>('POSTGRES_HOST'))
    this.loggerService.log(this.configService.get<string>('POSTGRES_NAME'))
    this.loggerService.log(this.configService.get<string>('POSTGRES_PASSWORD'))
    this.loggerService.log(this.configService.get<string>('POSTGRES_PORT'))
    this.pool = new Pool({
      user: this.configService.get<string>('POSTGRES_USER'),
      host: this.configService.get<string>('POSTGRES_HOST'),
      database: this.configService.get<string>('POSTGRES_NAME'),
      password: this.configService.get<string>('POSTGRES_PASSWORD'),
      port: this.configService.get<number>('POSTGRES_PORT')
    });
    // let a = this.query(
    //   `
    //   CREATE TABLE users (
    //       id SERIAL PRIMARY KEY,
    //       name VARCHAR(15) NOT NULL,
    //       email VARCHAR(40) UNIQUE NOT NULL,
    //       password VARCHAR(70) NOT NULL,
    //       secret VARCHAR(32) NOT NULL,
    //       two_fa BOOLEAN DEFAULT FALSE,
    //       join_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    //   );
      
    //   CREATE TABLE deeds (
    //       id SERIAL PRIMARY KEY,
    //       schema_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    //       name VARCHAR(15) NOT NULL,
    //       color VARCHAR(10) NOT NULL,
    //       scale VARCHA R(15),
    //       hasanaat BOOLEAN DEFAULT FALSE,
    //       hidden BOOLEAN DEFAULT FALSE,
    //       start_date DATE
    //   );
      
    //   CREATE TABLE items (
    //       id SERIAL PRIMARY KEY,
    //       deed_id INTEGER REFERENCES deeds(id) ON DELETE CASCADE,
    //       name VARCHAR(15) NOT NULL,
    //       color VARCHAR(10) NOT NULL,
    //       hidden BOOLEAN DEFAULT FALSE
    //   );
      
    //   CREATE TABLE scales (
    //       id SERIAL PRIMARY KEY,
    //       deed_id INTEGER REFERENCES deeds(id) ON DELETE CASCADE,
    //       name VARCHAR(15) NOT NULL,
    //       color VARCHAR(10) NOT NULL,
    //       rank INTEGER
    //   );
      
    //   CREATE TABLE records (
    //       id SERIAL PRIMARY KEY,
    //       item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    //       scale_id INTEGER REFERENCES scales(id) ON DELETE CASCADE,
    //       count INTEGER DEFAULT NULL,
    //       date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    //   );
    //   INSERT INTO users (name, password, email) VALUES ($1, $2, $3) RETURNING id; 
    //   `, 
    //   ['test', 'testpassword123', 'test@email.com']
    // );
    // this.loggerService.log(String(a));
  }

  private formatQuery(text: string, params?: unknown[]): string {
    if (!params || params.length === 0) {
      return text;
    }

    let formattedQuery: string = text;
    params.forEach((param: unknown, index: number) => {
      const placeholder: string = `$${index + 1}`;
      const formattedParam: string =
        typeof param === 'string' ? `'${param}'` : String(param);
      formattedQuery = formattedQuery.replace(placeholder, formattedParam);
    });
    return formattedQuery;
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const formattedQuery: string = this.formatQuery(text, params);
    this.loggerService.log(`Executing query: ${formattedQuery}`);
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async onModuleDestroy() : Promise<void> {
    await this.pool.end();
  }
}