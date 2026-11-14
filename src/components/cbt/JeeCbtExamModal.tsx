import React from 'react';
import {
  CBTMockSummary,
  CBTQuestion,
  ExamTrack,
  QuestionResponseState,
} from '../../utils/jeeEngine';
import { CBTMockExamView } from '../RevisePracticeProgressCBT';

export interface JeeCbtExamModalProps {
  sessionId?: string;
  resumeFromDraft?: boolean;
  candidateName: string;
  initialExamMode?: ExamTrack;
  customQuestions?: CBTQuestion[];
  customDurationMinutes?: number;
  customPaperTitle?: string;
  onSubmitMock: (
    summary: CBTMockSummary,
    focusEvents: number,
    questions?: CBTQuestion[],
    responses?: Record<string, QuestionResponseState>
  ) => void;
  onExitMock: () => void;
  onRecordMistake?: (question: CBTQuestion, userAnswer: string) => void;
}

export const JeeCbtExamModal: React.FC<JeeCbtExamModalProps> = ({
  sessionId,
  resumeFromDraft = false,
  candidateName,
  initialExamMode = 'JEE Main',
  customQuestions,
  customDurationMinutes,
  customPaperTitle,
  onSubmitMock,
  onExitMock,
  onRecordMistake,
}) => {
  return (
    <CBTMockExamView
      key={sessionId || initialExamMode}
      sessionId={sessionId}
      resumeFromDraft={resumeFromDraft}
      candidateName={candidateName}
      initialExamMode={initialExamMode}
      customQuestions={customQuestions}
      customDurationMinutes={customDurationMinutes}
      customPaperTitle={customPaperTitle}
      onSubmitMock={onSubmitMock}
      onExitMock={onExitMock}
      onRecordMistake={onRecordMistake}
    />
  );
};
