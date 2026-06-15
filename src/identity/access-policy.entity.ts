import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export interface AccessPolicyCreationAttrs {
  role: string;
  permissions: string[];
}

@Table({ tableName: 'access_policies', timestamps: true })
export class AccessPolicy extends Model<
  AccessPolicy,
  AccessPolicyCreationAttrs
> {
  @PrimaryKey
  @Column({ type: DataType.TEXT })
  declare role: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  permissions: string[];
}
