import { useCallback } from "react";

import { EmptyState } from "../EmptyState";
import { Loaded } from "../Loaded";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";
import { useLoad } from "../useLoad";

export function HistoryPage() {
  const { workouts } = useRepositories();
  const state = useLoad(useCallback(() => workouts.list(), [workouts]));

  return (
    <>
      <h1>{texts.history.title}</h1>
      <Loaded state={state}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title={texts.history.emptyTitle}
              hint={texts.history.emptyHint}
            />
          ) : (
            <p>{texts.history.count(list.length)}</p>
          )
        }
      </Loaded>
    </>
  );
}
