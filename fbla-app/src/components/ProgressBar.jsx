// Thin visual bar to go with useFakeProgress's percent — shared by every
// generation loading screen (quiz, flashcards, notes, presentation grading,
// Q&A) instead of each hand-rolling its own bar markup.
export default function ProgressBar({ percent }) {
  return (
    <div className="progress-bar-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
