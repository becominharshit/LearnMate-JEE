import React from 'react';
import { PracticeDashboardView, MistakeNotebookEntry } from './RevisePracticeProgressCBT';
import { CBTQuestion, ConvertedTestRecord, ExamTrack } from '../utils/jeeEngine';

export interface PracticeWorkspaceViewProps {
  onStartCBTMock: (mode?: ExamTrack, options?: { resume?: boolean }) => void;
  onOpenCustomTestModal: () => void;
  onOpenConvertOfflineModal: () => void;
  convertedTests: ConvertedTestRecord[];
  onLaunchConvertedTest: (record: ConvertedTestRecord) => void;
  onDeleteConvertedTest: (testId: string) => void;
  onOpenInstantPractice: (paperTitle: string, customQuestions?: CBTQuestion[]) => void;
  mistakesNotebook: MistakeNotebookEntry[];
  onRecordMistake: (q: CBTQuestion, userAnswer: string) => void;
}

export const PracticeWorkspaceView: React.FC<PracticeWorkspaceViewProps> = ({
  onStartCBTMock,
  onOpenCustomTestModal,
  onOpenConvertOfflineModal,
  convertedTests,
  onLaunchConvertedTest,
  onDeleteConvertedTest,
  onOpenInstantPractice,
  mistakesNotebook,
  onRecordMistake,
}) => {
  return (
    <PracticeDashboardView
      onStartCBTMock={onStartCBTMock}
      onOpenCustomTestModal={onOpenCustomTestModal}
      onOpenConvertOfflineModal={onOpenConvertOfflineModal}
      convertedTests={convertedTests}
      onLaunchConvertedTest={onLaunchConvertedTest}
      onDeleteConvertedTest={onDeleteConvertedTest}
      onOpenInstantPractice={onOpenInstantPractice}
      mistakesNotebook={mistakesNotebook}
      onRecordMistake={onRecordMistake}
    />
  );
};
