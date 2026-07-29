"use client";

import { CheckCircledIcon, CrossCircledIcon } from "@radix-ui/react-icons";

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
          <CheckCircledIcon className="mr-1.5 text-green-500" />
        ) : (
          <CrossCircledIcon className="mr-1.5 text-red-500" />
        )}
        <p>8+ characters</p>
      </div>
      <div className="flex items-center">
        {validation_result.uppercase ? (
          <CheckCircledIcon className="mr-1.5 text-green-500" />
        ) : (
          <CrossCircledIcon className="mr-1.5 text-red-500" />
        )}
        <p>1 uppercase</p>
      </div>
      <div className="flex items-center">
        {validation_result.number ? (
          <CheckCircledIcon className="mr-1.5 text-green-500" />
        ) : (
          <CrossCircledIcon className="mr-1.5 text-red-500" />
        )}
        <p>1 number</p>
      </div>
      <div className="flex items-center">
        {validation_result.specialChar ? (
          <CheckCircledIcon className="mr-1.5 text-green-500" />
        ) : (
          <CrossCircledIcon className="mr-1.5 text-red-500" />
        )}
        <p>1 special</p>
      </div>
    </div>
  );
};

export default PasswordValidation;
