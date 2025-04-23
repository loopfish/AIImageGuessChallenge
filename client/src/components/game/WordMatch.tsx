interface WordMatchProps {
  word: string;
}

export default function WordMatch({ word }: WordMatchProps) {
  return (
    <span className="px-2 py-1 bg-primary bg-opacity-10 text-primary rounded-md text-sm word-match">
      {word}
    </span>
  );
}
