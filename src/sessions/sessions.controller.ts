import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { extractGatewayUserAuth } from './gateway-auth';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** ALB OIDC headers from the logged-in user — forwarded to the SSH gateway. */
  private gatewayUserAuth(req: Request) {
    return extractGatewayUserAuth(req);
  }

  /**
   * UC: Start Session + Validate Access Policy + Issue Short-Lived JWT.
   * Validates CR/group access, proxies to the SSH gateway, persists the
   * session record, and returns a scoped JWT alongside the WebSocket URL.
   */
  @Post('start')
  @RequirePermission('access.launch')
  startSession(
    @Body() dto: StartSessionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.sessions.startSession(dto, user, this.gatewayUserAuth(req));
  }

  /**
   * UC: Select Existing Session — query the gateway for sessions that can be
   * rejoined for a given host/CR pair. Validates the caller's access policy
   * before forwarding the request to the gateway.
   */
  @Get('rejoin-candidates')
  @RequirePermission('access.launch')
  getRejoinCandidates(
    @Query('hostId') hostId: string,
    @Query('crId') crId: string | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.sessions.getRejoinCandidates(
      hostId,
      crId,
      user,
      this.gatewayUserAuth(req),
    );
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
   * UC: Reconnect Session — ask the gateway to issue a fresh WebSocket ticket
   * for an existing session. Returns { websocketUrl, sessionToken, scopedJwt }.
   */
  @Post(':id/rejoin')
  @RequirePermission('access.launch')
  rejoinSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.sessions.rejoinSession(id, user, this.gatewayUserAuth(req));
  }

  /**
   * UC: Observe Session — get a read-only WebSocket ticket for watching an
   * active session. Returns { websocketUrl, sessionToken }.
   */
  @Post(':id/observe')
  @RequirePermission('access.view')
  observeSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.sessions.observeSession(id, user, this.gatewayUserAuth(req));
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
