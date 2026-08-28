"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useWebhookReplay } from "@/hooks/useWebhookReplay";

interface ReplayButtonProps {
  deliveryId: string;
  targetUrl: string;
  payloadSize: number;
  isInFlight: boolean;
  isSubscriptionPaused: boolean;
}

export function ReplayButton({
  deliveryId,
  targetUrl,
  payloadSize,
  isInFlight,
  isSubscriptionPaused,
}: ReplayButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] =
    useState(false);

  const {
    mutate,
    isPending,
  } = useWebhookReplay();

  const isDisabled =
    isInFlight ||
    isSubscriptionPaused ||
    isPending;

  const disabledReason = isInFlight
    ? "Replay is unavailable while delivery is in-flight."
    : isSubscriptionPaused
      ? "Replay is unavailable because the subscription is paused."
      : undefined;

  const handleReplay = () => {
    mutate(deliveryId);
    setIsConfirmOpen(false);
  };

  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isDisabled}
      onClick={() => setIsConfirmOpen(true)}
    >
      <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
      Replay
    </Button>
  );

  return (
    <>
      {disabledReason ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{button}</span>
          </TooltipTrigger>

          <TooltipContent>
            {disabledReason}
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      <AlertDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Replay webhook delivery?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This will redeliver the webhook to:
              <br />
              <strong>{targetUrl}</strong>
              <br />
              Payload size:{" "}
              <strong>{payloadSize} bytes</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleReplay}
            >
              Replay Delivery
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}