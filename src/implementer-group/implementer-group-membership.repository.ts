import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ImplementerGroupMember } from './implementer-group-member.entity';
import {
  ImplementerGroupMembershipRequest,
  MembershipRequestStatus,
} from './implementer-group-membership-request.entity';

@Injectable()
export class ImplementerGroupMembershipRepository {
  constructor(
    @InjectModel(ImplementerGroupMembershipRequest)
    private requestModel: typeof ImplementerGroupMembershipRequest,
    @InjectModel(ImplementerGroupMember)
    private memberModel: typeof ImplementerGroupMember,
  ) {}

  findAllRequests(
    status?: MembershipRequestStatus,
  ): Promise<ImplementerGroupMembershipRequest[]> {
    return this.requestModel.findAll({
      where: status ? { status } : undefined,
      order: [['createdAt', 'DESC']],
    });
  }

  findRequestById(
    id: string,
  ): Promise<ImplementerGroupMembershipRequest | null> {
    return this.requestModel.findByPk(id);
  }

  findPendingRequest(
    username: string,
    implementerGroupId: string,
  ): Promise<ImplementerGroupMembershipRequest | null> {
    return this.requestModel.findOne({
      where: { username, implementerGroupId, status: MembershipRequestStatus.Pending },
    });
  }

  createRequest(
    data: Partial<ImplementerGroupMembershipRequest>,
  ): Promise<ImplementerGroupMembershipRequest> {
    return this.requestModel.create(data as any);
  }

  saveRequest(
    request: ImplementerGroupMembershipRequest,
  ): Promise<ImplementerGroupMembershipRequest> {
    return request.save();
  }

  findMembersByGroupId(
    implementerGroupId: string,
  ): Promise<ImplementerGroupMember[]> {
    return this.memberModel.findAll({
      where: { implementerGroupId },
      order: [['username', 'ASC']],
    });
  }

  findMember(
    username: string,
    implementerGroupId: string,
  ): Promise<ImplementerGroupMember | null> {
    return this.memberModel.findOne({ where: { username, implementerGroupId } });
  }

  createMember(
    username: string,
    implementerGroupId: string,
  ): Promise<ImplementerGroupMember> {
    return this.memberModel.create({ username, implementerGroupId });
  }

  removeMember(username: string, implementerGroupId: string): Promise<number> {
    return this.memberModel.destroy({ where: { username, implementerGroupId } });
  }

  findMembershipsForUser(username: string): Promise<ImplementerGroupMember[]> {
    return this.memberModel.findAll({
      where: { username },
      order: [['createdAt', 'DESC']],
    });
  }
}
