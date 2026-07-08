import { IsString, MaxLength } from 'class-validator';

export class AddUscisCaseDto {
  @IsString() @MaxLength(20) receiptNumber: string;
  @IsString() @MaxLength(30) caseType: string;
}
