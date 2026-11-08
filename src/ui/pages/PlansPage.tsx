import { useCallback } from "react";

import { EmptyState } from "../EmptyState";
import { Loaded } from "../Loaded";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";
import { useLoad } from "../useLoad";

export function PlansPage() {
  const { plans } = useRepositories();
  const state = useLoad(useCallback(() => plans.list(), [plans]));

  return (
    <>
      <h1>{texts.plans.title}</h1>
      <Loaded state={state}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title={texts.plans.emptyTitle}
              hint={texts.plans.emptyHint}
            />
          ) : (
            <ul className="list">
              {list.map((plan) => (
                <li key={plan.id}>{plan.name}</li>
              ))}
            </ul>
          )
        }
      </Loaded>
    </>
  );
}
