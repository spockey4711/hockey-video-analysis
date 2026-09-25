import { LegalDocument, LegalSectionBlock } from "./LegalDocument";
import {
  MissingOperatorNotice,
  OperatorAddress,
  OperatorContact,
} from "./OperatorDetails";
import { legalContent } from "./content";
import type { LegalOperator } from "./operator";

const { impressum } = legalContent;

/** The Impressum body for the given operator; the page resolves the operator. */
export function Impressum({ operator }: { operator: LegalOperator }) {
  return (
    <LegalDocument title={impressum.title}>
      <MissingOperatorNotice operator={operator} />
      <LegalSectionBlock heading={impressum.operatorHeading}>
        <OperatorAddress operator={operator} />
      </LegalSectionBlock>
      <LegalSectionBlock heading={impressum.contactHeading}>
        <OperatorContact operator={operator} />
      </LegalSectionBlock>
      <LegalSectionBlock heading={impressum.responsibleHeading}>
        <OperatorAddress operator={operator} />
      </LegalSectionBlock>
      <LegalSectionBlock heading={impressum.noteHeading}>
        <p>{impressum.note}</p>
      </LegalSectionBlock>
    </LegalDocument>
  );
}
