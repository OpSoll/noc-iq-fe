"use client";

import { CheckCircle, XCircle } from "lucide-react";

interface PasswordValidationProps {
  validation_result: {
    length: boolean;
    uppercase: boolean;
    number: boolean;
    specialChar: boolean;
  };
}

const PasswordValidation: React.FC<PasswordValidationProps> = ({
  validation_result,
}) => {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      <div className="flex items-center">
        {validation_result.length ? (
          <CheckCircle className="mr-1.5 h-4 w-4 text-green-500" aria-hidden="true" />
        ) : (
          <XCircle className="mr-1.5 h-4 w-4 text-red-500" aria-hidden="true" />
        )}
        <p>8+ characters</p>
      </div>
      <div className="flex items-center">
        {validation_result.uppercase ? (
          <CheckCircle className="mr-1.5 h-4 w-4 text-green-500" aria-hidden="true" />
        ) : (
          <XCircle className="mr-1.5 h-4 w-4 text-red-500" aria-hidden="true" />
        )}
        <p>1 uppercase</p>
      </div>
      <div className="flex items-center">
        {validation_result.number ? (
          <CheckCircle className="mr-1.5 h-4 w-4 text-green-500" aria-hidden="true" />
        ) : (
          <XCircle className="mr-1.5 h-4 w-4 text-red-500" aria-hidden="true" />
        )}
        <p>1 number</p>
      </div>
      <div className="flex items-center">
        {validation_result.specialChar ? (
          <CheckCircle className="mr-1.5 h-4 w-4 text-green-500" aria-hidden="true" />
        ) : (
          <XCircle className="mr-1.5 h-4 w-4 text-red-500" aria-hidden="true" />
        )}
        <p>1 special</p>
      </div>
    </div>
  );
};

export default PasswordValidation;