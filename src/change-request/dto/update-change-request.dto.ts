export class UpdateChangeRequestDto {
  title?: string;
  description?: string;
  approvalRoute?: string;
  comments?: string;
  activities?: string[];
  vmIds?: string[];
  allowedRoles?: string[];
  implementerGroupIds?: string[];
  /** ISO 8601 date string. Must not be in the past. */
  scheduledDate?: string;
}
