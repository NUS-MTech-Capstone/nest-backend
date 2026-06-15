import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  Default,
} from 'sequelize-typescript';

export enum ChangeRequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export interface ApprovalHistoryItem {
  when: string;
  actor: string;
  action: string;
  note: string;
}

export interface ChangeRequestCreationAttrs {
  title: string;
  description: string;
  requester: string;
  approvalRoute: string;
  comments?: string;
  status?: ChangeRequestStatus;
  history: ApprovalHistoryItem[];
  approver?: string;
  activities?: string[];
  vmIds?: string[];
  allowedRoles?: string[];
  implementerGroupIds?: string[];
}

@Table({ tableName: 'change_requests', timestamps: true })
export class ChangeRequest extends Model<
  ChangeRequest,
  ChangeRequestCreationAttrs
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.TEXT })
  title: string;

  @Column({ type: DataType.TEXT })
  description: string;

  @Column({ type: DataType.TEXT })
  requester: string;

  @Column({ type: DataType.TEXT })
  approvalRoute: string;

  @Column({
    type: DataType.ENUM(...Object.values(ChangeRequestStatus)),
    defaultValue: ChangeRequestStatus.Pending,
  })
  status: ChangeRequestStatus;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @Column({ type: DataType.TEXT, allowNull: true })
  approver?: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  comments?: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  history: ApprovalHistoryItem[];

  /** Activities that will be performed on the VMs under this change. */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  activities: string[];

  /** IDs of inventory VMs in scope for this change. */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  vmIds: string[];

  /** Roles (user groups) allowed to view/use this CR in the Access tab. Empty = everyone. */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  allowedRoles: string[];

  /** Implementer groups assigned to perform work on this change. */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  implementerGroupIds: string[];
}
