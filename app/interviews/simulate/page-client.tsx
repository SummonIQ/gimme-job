'use client';

import { QuestionCard } from '@/components/interviews/question-card';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import {
  DifficultyLevel,
  InterviewQuestion,
  InterviewType,
} from '@/lib/interviews/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

function InterviewSimulateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobTitle, setJobTitle] = useState('');
  const [jobLeadId, setJobLeadId] = useState(
    searchParams.get('jobLeadId') || '',
  );
  const [interviewType, setInterviewType] = useState<InterviewType>(
    InterviewType.BEHAVIORAL,
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    DifficultyLevel.MEDIUM,
  );
  const [questionCount, setQuestionCount] = useState(5);
  const [showTimer, setShowTimer] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [simulationInProgress, setSimulationInProgress] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [averageScore, setAverageScore] = useState(0);

  // Generate questions to start the simulation
  const generateQuestions = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch('/api/interviews/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobLeadId: jobLeadId || undefined,
          type: interviewType,
          count: questionCount,
          difficulty,
          jobTitle: jobTitle || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate interview questions');
      }

      const data = await response.json();

      if (data.success && data.data.length > 0) {
        setQuestions(data.data);
        setSimulationInProgress(true);
        toast({
          title: 'Interview questions generated',
          description: `${data.data.length} questions ready. Good luck!`,
        });
      } else {
        throw new Error('No questions were generated');
      }
    } catch (error) {
      toast({
        title: 'Error generating questions',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit response to current question
  const submitResponse = async (responseText: string) => {
    try {
      setIsEvaluating(true);

      const currentQuestion = questions[currentQuestionIndex];

      const response = await fetch('/api/interviews/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          response: responseText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to evaluate response');
      }

      const data = await response.json();

      if (data.success) {
        // Add response with feedback to the list
        const newResponse = {
          questionId: currentQuestion.id,
          answer: responseText,
          feedback: data.data.feedback,
          score: data.data.feedback.overallScore,
          quality: data.data.quality,
        };

        setResponses([...responses, newResponse]);

        // Check if this was the last question
        if (currentQuestionIndex === questions.length - 1) {
          // Simulation complete
          setSimulationComplete(true);
          generateOverallFeedback([...responses, newResponse]);
        } else {
          // Move to next question
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
      }
    } catch (error) {
      toast({
        title: 'Error evaluating response',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Generate overall feedback when simulation is complete
  const generateOverallFeedback = (allResponses: any[]) => {
    // Calculate average score
    const totalScore = allResponses.reduce((sum, r) => sum + (r.score || 0), 0);
    const avg = allResponses.length > 0 ? totalScore / allResponses.length : 0;
    setAverageScore(Math.round(avg));

    // Generate overall feedback based on score
    if (avg >= 85) {
      setOverallFeedback(
        'Excellent performance! You demonstrated strong interview skills across all questions. ' +
          'Your responses were clear, comprehensive, and effectively highlighted your qualifications. ' +
          "With this level of preparation, you're well-positioned for success in actual interviews.",
      );
    } else if (avg >= 70) {
      setOverallFeedback(
        'Good performance overall. You handled most questions effectively and showed solid interview skills. ' +
          'Consider incorporating the specific feedback provided to strengthen areas where you scored lower. ' +
          "With some additional preparation, you'll be ready for actual interviews.",
      );
    } else if (avg >= 50) {
      setOverallFeedback(
        'Fair performance with room for improvement. While you demonstrated some effective interview techniques, ' +
          'several responses could be stronger with more preparation and structure. ' +
          'Review the detailed feedback for each question and practice revising those answers before your actual interviews.',
      );
    } else {
      setOverallFeedback(
        'Your responses indicate you would benefit from significant additional preparation before interviews. ' +
          'Focus on developing more structured, detailed answers that highlight your qualifications. ' +
          'Consider researching common questions for your target role and preparing specific examples from your experience.',
      );
    }
  };

  // Start over with new questions
  const startOver = () => {
    setQuestions([]);
    setResponses([]);
    setCurrentQuestionIndex(0);
    setSimulationInProgress(false);
    setSimulationComplete(false);
    setOverallFeedback('');
  };

  // Calculate progress percentage
  const progress =
    questions.length > 0
      ? ((currentQuestionIndex + (simulationComplete ? 1 : 0)) /
          questions.length) *
        100
      : 0;

  // Get current question and response
  const currentQuestion = questions[currentQuestionIndex];
  const currentResponse = responses.find(
    r => currentQuestion && r.questionId === currentQuestion.id,
  );

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold">Interview Simulation</h1>
        <p className="text-muted-foreground">
          Practice and get AI feedback on your interview responses
        </p>
      </div>

      {!simulationInProgress ? (
        <Card>
          <CardHeader>
            <CardTitle>Setup Interview Simulation</CardTitle>
            <CardDescription>
              Configure your practice interview session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="jobTitle" className="text-sm font-medium">
                  Job Title
                </label>
                <Input
                  id="jobTitle"
                  placeholder="e.g., Software Engineer"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  disabled={isGenerating}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="interviewType" className="text-sm font-medium">
                  Interview Type
                </label>
                <Select
                  value={interviewType}
                  onValueChange={value =>
                    setInterviewType(value as InterviewType)
                  }
                  disabled={isGenerating}
                >
                  <SelectTrigger id="interviewType">
                    <SelectValue placeholder="Select interview type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(InterviewType).map(type => (
                      <SelectItem key={type} value={type}>
                        {type.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="difficulty" className="text-sm font-medium">
                  Difficulty Level
                </label>
                <Select
                  value={difficulty}
                  onValueChange={value =>
                    setDifficulty(value as DifficultyLevel)
                  }
                  disabled={isGenerating}
                >
                  <SelectTrigger id="difficulty">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(DifficultyLevel).map(level => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="questionCount" className="text-sm font-medium">
                  Number of Questions
                </label>
                <Select
                  value={questionCount.toString()}
                  onValueChange={value => setQuestionCount(parseInt(value))}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="questionCount">
                    <SelectValue placeholder="Select number of questions" />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 5, 7, 10].map(count => (
                      <SelectItem key={count} value={count.toString()}>
                        {count} questions
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showTimer}
                    onChange={e => setShowTimer(e.target.checked)}
                    className="form-checkbox"
                    disabled={isGenerating}
                  />
                  <span className="text-sm font-medium">
                    Show timer during questions
                  </span>
                </label>
              </div>
            </div>

            <Button
              className="w-full mt-4"
              onClick={generateQuestions}
              disabled={isGenerating || (!jobTitle && !jobLeadId)}
            >
              {isGenerating ? <Spinner className="mr-2" /> : null}
              {isGenerating
                ? 'Generating Questions...'
                : 'Start Interview Simulation'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {simulationComplete ? (
            <Card>
              <CardHeader>
                <CardTitle>Interview Simulation Complete</CardTitle>
                <CardDescription>
                  Review your performance and feedback
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center p-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">
                      Your Overall Score
                    </h3>
                    <div className="text-5xl font-bold text-primary">
                      {averageScore}/100
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Overall Feedback</h3>
                  <p className="text-gray-700">{overallFeedback}</p>
                </div>

                <Tabs defaultValue="questions">
                  <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="questions">
                      Questions & Answers
                    </TabsTrigger>
                    <TabsTrigger value="performance">
                      Performance Breakdown
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="questions" className="space-y-4 pt-4">
                    {questions.map((question, index) => {
                      const response = responses.find(
                        r => r.questionId === question.id,
                      );
                      return (
                        <div
                          key={question.id}
                          className="border rounded-lg p-4"
                        >
                          <h4 className="font-semibold">
                            Question {index + 1}: {question.question}
                          </h4>
                          {response && (
                            <div className="mt-2">
                              <div className="flex justify-between items-center text-sm mb-1">
                                <span className="font-medium">
                                  Your Response:
                                </span>
                                <span className="font-bold">
                                  {response.score}/100
                                </span>
                              </div>
                              <p className="text-gray-700 text-sm whitespace-pre-wrap bg-gray-50 p-2 rounded">
                                {response.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="performance" className="pt-4">
                    <div className="space-y-6">
                      {/* Score breakdown by question */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4">
                          Question Scores
                        </h3>
                        <div className="space-y-3">
                          {responses.map((response, index) => {
                            const question = questions.find(
                              q => q.id === response.questionId,
                            );
                            return (
                              <div
                                key={response.questionId}
                                className="flex items-center"
                              >
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                                  {index + 1}
                                </div>
                                <div className="ml-3 flex-grow">
                                  <div className="text-sm font-medium truncate max-w-md">
                                    {question?.question}
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                    <div
                                      className="bg-primary h-2.5 rounded-full"
                                      style={{ width: `${response.score}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <div className="ml-2 text-sm font-medium">
                                  {response.score}/100
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={startOver}>
                    Start New Simulation
                  </Button>
                  <Button onClick={() => router.push('/dashboard')}>
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            currentQuestion && (
              <QuestionCard
                question={currentQuestion}
                onSubmitResponse={submitResponse}
                isLoading={isEvaluating}
                feedback={currentResponse?.feedback}
                showTimer={showTimer}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function InterviewSimulatePage() {
  return <InterviewSimulateContent />;
}
