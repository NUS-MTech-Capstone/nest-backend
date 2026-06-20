import {
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

export type SessionStatus = 'active' | 'ended' | 'disconnected';

@Table({ tableName: 'access_sessions', timestamps: true })
export class Session extends Model<Session> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  /** Inventory VM UUID */
  @Column({ type: DataType.TEXT })
  hostId: string;

  /** Hostname at launch time (denormalised for display without joins) */
  @Column({ type: DataType.TEXT })
  hostname: string;

  /** IP address at launch time */
  @Column({ type: DataType.TEXT, allowNull: true })
  ipAddress?: string;

  /** SSH port at launch time */
  @Column({ type: DataType.INTEGER, allowNull: true })
  sshPort?: number;

  /** Linked approved change request UUID (null for group-based access) */
  @Column({ type: DataType.UUID, allowNull: true })
  crId?: string;

  /** Formatted CR label, e.g. "CR-ABCD1234" */
  @Column({ type: DataType.TEXT, allowNull: true })
  crNumber?: string;

  /** OS user used for the SSH connection */
  @Column({ type: DataType.TEXT })
  osUser: string;

  /** Username of the principal who started the session */
  @Column({ type: DataType.TEXT })
  createdBy: string;

  @Column({ type: DataType.TEXT, defaultValue: 'active' })
  status: SessionStatus;

  /** Session ID assigned by the SSH gateway (used for rejoin/observe calls) */
  @Column({ type: DataType.TEXT, allowNull: true })
  gatewaySessionId?: string;

  /** Token returned by the SSH gateway for WebSocket auth */
  @Column({ type: DataType.TEXT, allowNull: true })
  sessionToken?: string;

  /** WebSocket URL returned by the SSH gateway */
  @Column({ type: DataType.TEXT, allowNull: true })
  websocketUrl?: string;

  /** Short-lived scoped JWT issued by this platform at session start */
  @Column({ type: DataType.TEXT, allowNull: true })
  scopedJwt?: string;

  @Column({ type: DataType.DATE })
  startedAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  endedAt?: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  lastActivityAt?: Date;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}
