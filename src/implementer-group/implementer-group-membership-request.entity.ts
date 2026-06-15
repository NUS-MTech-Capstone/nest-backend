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

export enum MembershipRequestStatus {
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

export interface ImplementerGroupMembershipRequestCreationAttrs {
  username: string;
  implementerGroupId: string;
  requester: string;
  comments?: string;
  status?: MembershipRequestStatus;
  history: ApprovalHistoryItem[];
}

@Table({
  tableName: 'implementerGroupMembershipRequests',
  timestamps: true,
  underscored: false,
})
export class ImplementerGroupMembershipRequest extends Model<
  ImplementerGroupMembershipRequest,
  ImplementerGroupMembershipRequestCreationAttrs
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.TEXT, field: 'username' })
  username: string;

  @Column({ type: DataType.UUID, field: 'implementerGroupId' })
  implementerGroupId: string;

  @Column({ type: DataType.TEXT, field: 'requester' })
  requester: string;

  @Column({
    type: DataType.ENUM(...Object.values(MembershipRequestStatus)),
    defaultValue: MembershipRequestStatus.Pending,
    field: 'status',
  })
  status: MembershipRequestStatus;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'comments' })
  comments?: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'approver' })
  approver?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'history',
  })
  history: ApprovalHistoryItem[];

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'createdAt' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updatedAt' })
  declare updatedAt: Date;
}
