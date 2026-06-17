import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /**
   * UC: Start Session + Validate Access Policy + Issue Short-Lived JWT.
   * Validates CR/group access, proxies to the SSH gateway, persists the
   * session record, and returns a scoped JWT alongside the WebSocket URL.
   */
  @Post('start')
  @RequirePermission('access.launch')
  startSession(@Body() dto: StartSessionDto, @CurrentUser() user: AuthUser) {
    return this.sessions.startSession(dto, user);
  }

  /**
   * UC: Select Existing Session — list all active sessions across the platform.
   * Optionally filter by hostId to show sessions for a specific server.
   */
  @Get('active')
  @RequirePermission('access.view')
  listActive(@Query('hostId') hostId?: string) {
    return this.sessions.listActiveSessions(hostId);
  }

  /**
   * UC: Reconnect Session — return the current user's recent sessions so they
   * can reconnect to a session they previously disconnected from.
   */
  @Get('mine')
  @RequirePermission('access.view')
  listMine(@CurrentUser() user: AuthUser) {
    return this.sessions.listMySessions(user.username);
  }

  /** Get a single session's details. */
  @Get(':id')
  @RequirePermission('access.view')
  getOne(@Param('id') id: string) {
    return this.sessions.getSession(id);
  }

  /**
   * UC: Reconnect Session — retrieve stored gateway credentials for a specific
   * session so the terminal can reconnect without a new SSH gateway handshake.
   * Issues a fresh short-lived scoped JWT.
   */
  @Get(':id/token')
  @RequirePermission('access.launch')
  getToken(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.getSessionToken(id, user);
  }

  /**
   * UC: Track Session State — marks a session as ended and records the end time.
   */
  @Patch(':id/end')
  @RequirePermission('access.view')
  endSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.endSession(id, user.username);
  }

  /** Mark a session as disconnected (called by terminal on unexpected close). */
  @Patch(':id/disconnect')
  @RequirePermission('access.view')
  disconnect(@Param('id') id: string) {
    return this.sessions.markDisconnected(id);
  }
}
