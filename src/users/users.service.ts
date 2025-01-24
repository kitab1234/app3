import { Logger } from 'src/logger/logger.service';
import { AuthenticatedRequest } from 'src/auth/auth.interface';
import { UpdateUsernameDto } from './dto/update-user-name.dto';
import { PostgresService } from 'src/postgres/postgres.service';
import { BadRequestException, Injectable, NotFoundException, HttpException } from '@nestjs/common';

@Injectable()
export class UsersService {

  constructor(
    private readonly postgresService: PostgresService,
    private readonly loggerService: Logger
  ) {}

  // Controller functions

  async userInfo(request: AuthenticatedRequest): Promise<{ info: Object }> {
    try {
      const { email } = request.user;
      this.loggerService.log('userInfo {controller}');
      const info = await this.getUserInfo(email);
      return { info };
    } catch(error) {
      this.loggerService.error(error.message, error.status ?? 500);
      throw new HttpException(error.message, error.status ?? 500);
    }
  }

  async updateName(request: AuthenticatedRequest, body: UpdateUsernameDto): Promise<void> {
    try {
      const { email } = request.user;
      const { name } = body;
      this.loggerService.log('updateName {controller}');
      await this.updateUsername(email, name);
    } catch(error) {
      this.loggerService.error(error.message, error.status ?? 500);
      throw new HttpException(error.message, error.status ?? 500);
    }
  }

  async deleteUser(request: AuthenticatedRequest): Promise<void> {
    try {
      const { email } = request.user;
      this.loggerService.log('deleteUser {controller}');
      await this.delUser(email);
    } catch(error) {
      this.loggerService.error(error.message, error.status ?? 500);
      throw new HttpException(error.message, error.status ?? 500);
    }
  }

  // Helper functions

  async createUser(body: { name: string, email: string, password: string, secret: string }): Promise<{ id: number; name: string, email: string; }> {
    this.loggerService.log('createUser {query}');
    const result : { id: number; name: string, email: string; }[] = await this.postgresService.query(`
      INSERT INTO users (name, email, password, secret) VALUES ($1, $2, $3, $4) RETURNING id, name, email;`,
      [ body.name, body.email, body.password, body.secret ]
    );
    if (result.length !== 1)
      throw new BadRequestException('Failed to register user')
    return result[0];
  }

  async getUser(email: string): Promise<{ id: number; name: string, email: string; password: string; two_fa: boolean; join_date: Date }> {
    this.loggerService.log('getUser {query}');
    const result : { id: number; name: string, email: string; password: string; two_fa: boolean; join_date: Date }[] = await this.postgresService.query(`
      SELECT id, name, email, password, two_fa, join_date FROM users WHERE email = $1`,
      [ email ]
    )
    if (!result.length)
      throw new NotFoundException('Invalid email or credentials');
    return result[0];
  }

  async getUserInfo(email: string): Promise<{ id: number; name: string, email: string; two_fa: boolean; join_date: Date, deeds: Object }> {
    this.loggerService.log('getUserInfo {query}');
    const result : { user_info: { id: number; name: string, email: string; two_fa: boolean; join_date: Date, deeds: Object } }[] = await this.postgresService.query(`
      WITH items_agg AS (
        SELECT
          i.deed_id,
          jsonb_agg(
            jsonb_build_object(
              'id', i.id,
              'name', i.name,
              'color', i.color,
              'hidden', i.hidden
            ) ORDER BY i.id
          ) AS items
        FROM items i
        GROUP BY i.deed_id
      ),
      scales_agg AS (
        SELECT
          s.deed_id,
          jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'name', s.name,
              'color', s.color,
              'rank', s.rank
            ) ORDER BY s.id
        ) AS scales
        FROM scales s
        GROUP BY s.deed_id
      ),
      deeds_agg AS (
        SELECT
          d.user_id,
          jsonb_agg(
            jsonb_build_object(
              'id', d.id,
              'name', d.name,
              'color', d.color,
              'scale', d.scale,
              'hasanaat', d.hasanaat,
              'hidden', d.hidden,
              'start_date', d.start_date,
              'items', COALESCE(i.items, '[]'::jsonb),
              'scales', COALESCE(s.scales, '[]'::jsonb)
            ) ORDER BY d.id
          ) AS deeds
        FROM deeds d
        LEFT JOIN items_agg i ON i.deed_id = d.id
        LEFT JOIN scales_agg s ON s.deed_id = d.id
        GROUP BY d.user_id
      )
      SELECT row_to_json(user_data) AS user_info
      FROM (
        SELECT
          u.id, u.name, u.email, u.two_fa, u.join_date,
          COALESCE(da.deeds, '[]'::jsonb) AS deeds
        FROM users u
        LEFT JOIN deeds_agg da ON da.user_id = u.id
        WHERE u.email = $1
      ) user_data;
    `,
    [ email ]
    )
    if (!result.length)
      throw new NotFoundException('Invalid email or credentials');
    return result[0].user_info;
  }

  async getUserSecret(email: string): Promise<{ name: string; secret: string; }> {
    this.loggerService.log('createUser {query}');
    const result : { name: string; secret: string; }[] = await this.postgresService.query(`
      SELECT name, secret FROM users WHERE email = $1`,
      [ email ]
    )
    if (!result.length)
      throw new NotFoundException('Invalid email or credentials');
    return result[0];
  }

  async checkEmailAvailability(email: string): Promise<boolean> {
    this.loggerService.log('checkEmailAvailability {query}');
    const result = await this.postgresService.query(`
    SELECT current_database(), current_user, inet_server_addr(), inet_server_port();

      `,
      []
    );
    console.log(result);
    // return !!result.length
    return true
  }

  async getPasswordByEmail(email: string): Promise<string> {
    this.loggerService.log('getPasswordByEmail {query}');
    const result : { password: string }[] = await this.postgresService.query(`
      SELECT password FROM users WHERE email = $1`,
      [email]
    );
    if (!result.length)
      throw new NotFoundException('Invalid email or credentials');
    return result[0].password
  }

  async updatePassword(email: string, password: string): Promise<void> {
    this.loggerService.log('updatePassword {query}');
    const result: { id: number }[] = await this.postgresService.query(`
      UPDATE users SET password = $2 WHERE email = $1 RETURNING id;`,
      [email, password]
    );
    if (!result.length)
      throw new NotFoundException('Invalid email or credentials');
  }

  async update2fa(email: string, toggle: boolean): Promise<void> {
    this.loggerService.log('update2fa {query}');
    const result: { two_fa: boolean }[] = await this.postgresService.query(`
      UPDATE users SET two_fa = $2 WHERE email = $1 RETURNING id;`,
      [email, toggle],
    );
    if (!result.length)
      throw new NotFoundException('Invalid email or credentials');
  }

  async updateUsername(email: string, name: string): Promise<void> {
    this.loggerService.log('update2fa {query}');
    const result: { id: number }[] = await this.postgresService.query(`
      UPDATE users SET name = $2 WHERE email = $1 RETURNING id;`,
      [email, name],
    );
    if (!result.length)
      throw new NotFoundException('Invalid email or credentials');
  }

  async delUser(email: string): Promise<void> {
    this.loggerService.log('delUser {query}');
    const result: { id: number }[] = await this.postgresService.query(`
      DELETE FROM users WHERE email = $1 RETURNING id;`,
      [email],
    );
    if (!result.length)
      throw new NotFoundException('User not found');
  }
}