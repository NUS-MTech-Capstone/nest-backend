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

export interface ImplementerGroupMemberCreationAttrs {
  username: string;
  implementerGroupId: string;
}

@Table({
  tableName: 'implementerGroupMembers',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      unique: true,
      fields: ['username', 'implementerGroupId'],
      name: 'implementer_group_members_user_group_unique',
    },
  ],
})
export class ImplementerGroupMember extends Model<
  ImplementerGroupMember,
  ImplementerGroupMemberCreationAttrs
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.TEXT, field: 'username' })
  username: string;

  @Column({ type: DataType.UUID, field: 'implementerGroupId' })
  implementerGroupId: string;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'createdAt' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updatedAt' })
  declare updatedAt: Date;
}
