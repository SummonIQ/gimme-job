'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';
import { InterviewQuestion, InterviewResponseQuality } from '@/lib/interviews/types';
import { cn } from '@/lib/css';

interface QuestionCardProps {
  question: InterviewQuestion;
  onSubmitResponse: (response: string) => Promise<void>;
  isLoading?: boolean;
  feedback?: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    score: number;
    quality: InterviewResponseQuality;
  };
  showTimer?: boolean;
}

export function QuestionCard({
  question,
  onSubmitResponse,
  isLoading = false,
  feedback,
  showTimer = false,
}: QuestionCardProps) {
  const [response, setResponse] = useState('');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  
  // Start timer when component mounts if showTimer is true
  useState(() => {
    if (showTimer) {
      setTimerRunning(true);
      const timer = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
      
      return () => {
        clearInterval(timer);
        setTimerRunning(false);
      };
    }
  });
  
  const handleSubmit = async () => {
    if (response.trim()) {
      setTimerRunning(false);
      await onSubmitResponse(response);
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HARD':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BEHAVIORAL':
        return 'bg-blue-100 text-blue-800';
      case 'TECHNICAL':
        return 'bg-purple-100 text-purple-800';
      case 'SYSTEM_DESIGN':
        return 'bg-indigo-100 text-indigo-800';
      case 'CASE_STUDY':
        return 'bg-cyan-100 text-cyan-800';
      case 'ROLE_SPECIFIC':
        return 'bg-pink-100 text-pink-800';
      case 'HR_SCREENING':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getQualityBadge = (quality: InterviewResponseQuality) => {
    switch (quality) {
      case 'EXCELLENT':
        return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
      case 'GOOD':
        return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
      case 'FAIR':
        return <Badge className="bg-orange-100 text-orange-800">Fair</Badge>;
      case 'POOR':
        return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full mb-6">
      <CardHeader>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge className={getDifficultyColor(question.difficulty)}>{question.difficulty}</Badge>
          <Badge className={getTypeColor(question.type)}>{question.type.replace('_', ' ')}</Badge>
          {showTimer && (
            <Badge variant="outline" className="ml-auto">
              <Clock className="mr-1 h-3 w-3" />
              {formatTime(timeElapsed)}
            </Badge>
          )}
        </div>
        <CardTitle className="text-xl">{question.question}</CardTitle>
        {question.description && (
          <CardDescription className="mt-2">
            <div className="flex items-start">
              <Info className="h-4 w-4 mr-2 mt-1 text-blue-500" />
              <span>{question.description}</span>
            </div>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {feedback ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Your Response</h3>
              <div className="flex items-center gap-2">
                <span className={cn("font-bold text-lg", getScoreColor(feedback.score))}>
                  {feedback.score}/100
                </span>
                {getQualityBadge(feedback.quality)}
              </div>
            </div>
            <div className="whitespace-pre-wrap text-gray-700 bg-gray-50 p-4 rounded-md border">
              {response}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center text-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" /> Strengths
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  {feedback.strengths.map((strength, i) => (
                    <li key={i} className="text-sm text-gray-700">{strength}</li>
                  ))}
                </ul>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center text-amber-700">
                  <AlertTriangle className="h-4 w-4 mr-2" /> Areas to Improve
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  {feedback.weaknesses.map((weakness, i) => (
                    <li key={i} className="text-sm text-gray-700">{weakness}</li>
                  ))}
                </ul>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center text-blue-700">
                  <Info className="h-4 w-4 mr-2" /> Suggestions
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  {feedback.suggestions.map((suggestion, i) => (
                    <li key={i} className="text-sm text-gray-700">{suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Type your answer below. Try to be specific, structured, and clear in your response.
              {showTimer && " The timer is running to simulate real interview conditions."}
            </p>
            <Textarea
              placeholder="Enter your response here..."
              rows={8}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="w-full"
              disabled={isLoading}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        {!feedback && (
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !response.trim()}
            className="ml-auto"
          >
            {isLoading ? 'Submitting...' : 'Submit Response'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
