import {
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

@Table({ tableName: 'alert_events', timestamps: true, updatedAt: false })
export class AlertEvent extends Model<AlertEvent> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.TEXT })
  alarmName: string;

  /** ALARM | OK | INSUFFICIENT_DATA */
  @Column({ type: DataType.TEXT })
  state: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  description?: string;

  @Column({ type: DataType.TEXT })
  metric: string;

  @Column({ type: DataType.TEXT })
  source: string;

  @Column({ type: DataType.DATE })
  triggeredAt: Date;

  @Column({ type: DataType.JSONB, allowNull: true })
  rawPayload?: Record<string, unknown>;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;
}
