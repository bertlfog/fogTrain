import { useCallback } from "react";

import { EmptyState } from "../EmptyState";
import { Loaded } from "../Loaded";
import { paths } from "../navigation";
import { useRepositories } from "../RepositoryContext";
import { texts } from "../texts";
import { useLoad } from "../useLoad";

export function StartPage() {
  const { plans } = useRepositories();
  const state = useLoad(useCallback(() => plans.list(), [plans]));

  return (
    <>
      <h1>{texts.start.title}</h1>
      <Loaded state={state}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title={texts.start.emptyTitle}
              hint={texts.start.emptyHint}
              action={{ label: texts.start.emptyAction, to: paths.exercises }}
            />
          ) : (
            <section aria-labelledby="start-plans">
              <h2 id="start-plans">{texts.start.plansHeading}</h2>
              <ul className="list">
                {list.map((plan) => (
                  <li key={plan.id}>{plan.name}</li>
                ))}
              </ul>
            </section>
          )
        }
      </Loaded>
    </>
  );
}
