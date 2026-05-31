'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Check,
  Edit2,
  FileText,
  Linkedin,
  SkipForward,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface FieldSuggestionCardProps {
  id: string;
  fieldName: string;
  fieldLabel?: string;
  fieldType: string;
  suggestedValue?: string;
  currentValue?: string;
  userValue?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'SKIPPED';
  confidence?: number;
  suggestedSource?: string;
  isRequired: boolean;
  category?: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onModify: (id: string, value: string) => void;
  onSkip: (id: string) => void;
  disabled?: boolean;
}

const FieldSuggestionCard = ({
  id,
  fieldName,
  fieldLabel,
  fieldType,
  suggestedValue,
  currentValue,
  userValue,
  status,
  confidence,
  suggestedSource,
  isRequired,
  category,
  onAccept,
  onReject,
  onModify,
  onSkip,
  disabled,
}: FieldSuggestionCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(userValue ?? suggestedValue ?? '');

  const handleAccept = () => {
    onAccept(id);
  };

  const handleReject = () => {
    onReject(id);
  };

  const handleModify = () => {
    if (isEditing) {
      onModify(id, editValue);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleSkip = () => {
    onSkip(id);
  };

  const getSourceIcon = () => {
    switch (suggestedSource) {
      case 'profile':
        return <User className="h-3 w-3" />;
      case 'resume':
        return <FileText className="h-3 w-3" />;
      case 'linkedin':
        return <Linkedin className="h-3 w-3" />;
      case 'ai':
        return <Sparkles className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getStatusStyles = () => {
    switch (status) {
      case 'ACCEPTED':
        return 'border-green-200 bg-green-50';
      case 'REJECTED':
        return 'border-red-200 bg-red-50';
      case 'MODIFIED':
        return 'border-blue-200 bg-blue-50';
      case 'SKIPPED':
        return 'border-muted bg-muted/30';
      default:
        return 'border-border';
    }
  };

  const displayValue = status === 'MODIFIED' ? userValue : suggestedValue;
  const isTextarea =
    fieldType === 'textarea' || (suggestedValue?.length ?? 0) > 100;

  return (
    <Card className={cn('transition-all', getStatusStyles())}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {fieldLabel ?? fieldName}
              </span>
              {isRequired && (
                <Badge variant="destructive" className="text-xs px-1 py-0">
                  Required
                </Badge>
              )}
              {category && (
                <Badge
                  variant="secondary"
                  className="text-xs px-1 py-0 capitalize"
                >
                  {category}
                </Badge>
              )}
            </div>

            {status !== 'PENDING' && (
              <Badge
                variant={
                  status === 'ACCEPTED'
                    ? 'default'
                    : status === 'REJECTED'
                      ? 'destructive'
                      : status === 'MODIFIED'
                        ? 'secondary'
                        : 'outline'
                }
                className="mb-2 text-xs"
              >
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </Badge>
            )}

            {isEditing ? (
              <div className="mt-2">
                {isTextarea ? (
                  <Textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="min-h-[80px]"
                    placeholder={`Enter ${fieldLabel ?? fieldName}...`}
                  />
                ) : (
                  <Input
                    type={
                      fieldType === 'email'
                        ? 'email'
                        : fieldType === 'tel'
                          ? 'tel'
                          : 'text'
                    }
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder={`Enter ${fieldLabel ?? fieldName}...`}
                  />
                )}
              </div>
            ) : (
              <div className="mt-2">
                {displayValue ? (
                  <div className="flex items-start gap-2">
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      {getSourceIcon()}
                    </div>
                    <p className="text-sm text-foreground break-words">
                      {displayValue}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No suggestion available
                  </p>
                )}

                {confidence !== undefined &&
                  confidence > 0 &&
                  status === 'PENDING' && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden max-w-[100px]">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            confidence >= 0.8
                              ? 'bg-green-500'
                              : confidence >= 0.5
                                ? 'bg-yellow-500'
                                : 'bg-orange-500',
                          )}
                          style={{ width: `${confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    </div>
                  )}
              </div>
            )}
          </div>

          {status === 'PENDING' && (
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                size="sm"
                variant="default"
                onClick={handleAccept}
                disabled={disabled || !suggestedValue}
                className="h-8"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleModify}
                disabled={disabled}
                className="h-8"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {!isRequired && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={disabled}
                  className="h-8"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReject}
                disabled={disabled}
                className="h-8 text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {isEditing && (
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                size="sm"
                variant="default"
                onClick={handleModify}
                disabled={disabled}
                className="h-8"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditValue(userValue ?? suggestedValue ?? '');
                }}
                className="h-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
FieldSuggestionCard.displayName = 'FieldSuggestionCard';

export { FieldSuggestionCard };
