import { runRepositoryContract } from "../contract";
import { createMemoryRepositories } from "./index";

runRepositoryContract("In-Memory", async () => createMemoryRepositories());
