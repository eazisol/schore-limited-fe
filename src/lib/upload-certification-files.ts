import { usersService, type ApiUser } from "@/lib/api/services/users";
import {
  resolveCertificationIdsForUpload,
  type CertificationFormValue,
} from "@/lib/operative-certifications";

/** After user save, upload any pending certification files matched by clientKey/id. */
export async function uploadPendingCertificationFiles(
  userId: string,
  formRows: CertificationFormValue[],
  savedUser: ApiUser | undefined,
): Promise<void> {
  const uploads = resolveCertificationIdsForUpload(formRows, savedUser?.certifications);
  for (const item of uploads) {
    if (!item.files.length) continue;
    await usersService.uploadCertificationFiles(userId, item.certificationId, item.files);
  }
}
