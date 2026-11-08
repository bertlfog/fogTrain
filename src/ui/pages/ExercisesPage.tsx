import { useCallback } from "react";

import { EmptyState } from "../EmptyState";
import { Loaded } from "../Loaded";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";
import { useLoad } from "../useLoad";

export function ExercisesPage() {
  const { exercises } = useRepositories();
  const state = useLoad(useCallback(() => exercises.list(), [exercises]));

  return (
    <>
      <h1>{texts.exercises.title}</h1>
      <Loaded state={state}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title={texts.exercises.emptyTitle}
              hint={texts.exercises.emptyHint}
            />
          ) : (
            <ul className="list">
              {list.map((exercise) => (
                <li key={exercise.id}>{exercise.name}</li>
              ))}
            </ul>
          )
        }
      </Loaded>
    </>
  );
}
