import { useEffect, useState } from "react";
import Table, { Role } from "./Table";
import { Toaster, toast } from "react-hot-toast";
import { getGameState, updateGameState, resetGameState } from "../apis/gameStateAPI";

const RIVER_DEPTH = 20;
const MAX_RAIN = 25;
const DREDGE_EFFECT = 10;
const DREDGE_COST = 10;
const DREDGE_PER_ROUND = 1;

export const PlayerType = {
  RESIDENTS: 'residents',
  INDUSTRIALISTS: 'industrialists',
  MODERATOR: 'moderator',
};

const Board = () => {
  const [hydration, setHydration] = useState(false)
  const [resetFlag, setResetFlag] = useState(0);
  const [nextFlag, setNextFlag] = useState(0);
  const [flood, setFlood] = useState({ round: 0, level: 0 });
  const [sediment, setSediment] = useState(-1);
  const [sediment1, setSediment1] = useState(-1);
  const [sediment2, setSediment2] = useState(-1);

  const [subsidence, setSubsidence] = useState(-1);
  const [subsidence1, setSubsidence1] = useState(-1);
  const [subsidence2, setSubsidence2] = useState(-1);
  const [floodProb, setFloodProb] = useState(0);

  const [tax1, setTax1] = useState(0);
  const [tax2, setTax2] = useState(0);

  const [remainingDredges, setRemainingDredges] = useState(DREDGE_PER_ROUND);
  const [govBudget, setGovBudget] = useState(-1);

  const [player, setPlayer] = useState('');

  const fetchData = async () => {
    const res = await getGameState('board')
    setResetFlag(res.resetFlag)
    setNextFlag(res.nextFlag)
    setFlood((prev) => {
      if (prev.level !== res.flood.level || prev.round !== res.flood.round) {
        return res.flood
      }
      return prev
    })

    setSediment(res.sediment)
    setSediment1(res.sediment1)
    setSediment2(res.sediment2)
    setSubsidence(res.subsidence)
    setSubsidence1(res.subsidence1)
    setSubsidence2(res.subsidence2)
    setGovBudget(res.govBudget)
    setFloodProb(res.floodProb)
    setTax1(res.tax1)
    setTax2(res.tax2)
    setRemainingDredges(res.remainingDredges)
  }

  useEffect(() => {
    if (player === '') {
      return
    }

    if (!hydration) {
      setHydration(true)
      fetchData()
    }

    if (player === PlayerType.MODERATOR) {
      return
    }

    const interval = setInterval(() => fetchData(), 1000)

    return () => clearInterval(interval);
  }, [player])

  // useEffect(() => {
  //   setPauseFetching(true)
  //   const checkUpdateFinish = async () => {
  //     let res1 = await getGameState('board')
  //     console.log('FLAG', res1.nextFlag, nextFlag)
  //     while (res1.nextFlag < nextFlag && res1.resetFlag < resetFlag) {
  //       res1 = await getGameState('board')
  //       console.log('WAIIIIIT UPDATE FINISH')
  //     }
  //     setPauseFetching(false)
  //   }
  //   checkUpdateFinish()
  // }, [nextFlag, resetFlag])

  // useEffect(() => console.log('HEY THERE', resetFlag, nextFlag),[
  //   resetFlag, 
  //   nextFlag,
  //   // flood,
  //   // sediment,
  //   // sediment1,
  //   // sediment2,
  //   // subsidence,
  //   // subsidence1,
  //   // subsidence2,
  //   // govBudget,
  //   // floodProb,
  //   // tax1,
  //   // tax2,
  //   // remainingDredges
  // ])

  useEffect(() => {
    if (!hydration || player !== PlayerType.MODERATOR) {
      return
    }
    const data = {
      resetFlag: resetFlag,
      nextFlag: nextFlag,
      flood: flood,
      sediment: sediment,
      sediment1: sediment1,
      sediment2: sediment2,
      subsidence: subsidence,
      subsidence1: subsidence1,
      subsidence2: subsidence2,
      govBudget: govBudget,
      floodProb: floodProb,
      tax1: tax1,
      tax2: tax2,
      remainingDredges: remainingDredges
    }
    console.log('HELLO', data)
    updateGameState('board', data);
    }, [sediment, subsidence, govBudget, tax1, tax2, resetFlag, nextFlag, sediment1, sediment2, subsidence1, subsidence2, floodProb, remainingDredges]);
  // }, [nextFlag, resetFlag]);

  const addSediment = (value) => {
    if (sediment + value > RIVER_DEPTH * 30) {
      setSediment(RIVER_DEPTH * 30);
      return;
    }
    setSediment(sediment + value);
  };

  const increaseSubsidence = (value) => {
    if (subsidence + value > RIVER_DEPTH * 15) {
      setSubsidence(RIVER_DEPTH * 15);
      return;
    }
    setSubsidence(subsidence + value);
  };

  //   const removeSediment = (value) => {
  //     setSediment(sediment - value);
  //   };

  useEffect(() => {
    if (sediment1 > -1 && sediment2 > -1) {
      addSediment(sediment1 + sediment2);
      setSediment1(-1);
      setSediment2(-1);
    }
  }, [sediment1, sediment2]);

  useEffect(() => {
    if (subsidence1 > -1 && subsidence2 > -1) {
      increaseSubsidence(subsidence1 + subsidence2);
      setSubsidence1(-1);
      setSubsidence2(-1);
    }
  }, [subsidence1, subsidence2]);

  useEffect(() => {
    if (tax1 > 0 || tax2 > 0) {
      setGovBudget(govBudget + tax1 + tax2);
      setTax1(0);
      setTax2(0);
    }
  }, [tax1, tax2]);

  const restart = () => {
    setResetFlag(resetFlag + 1);
    setNextFlag(0);
    setSediment(0);
    setSubsidence(0);
    setGovBudget(0);
    toast.success("New Game!", {
      position: "bottom-center",
    });
  };

  const getFloodLevel = () => {
    const rainLevel = Math.floor(Math.random() * MAX_RAIN);
    const sedimentLevel = Math.floor(sediment / 20);
    const subsidenceLevel = Math.floor(subsidence / 10);
    const floodLevel =
      sedimentLevel + rainLevel + subsidenceLevel - RIVER_DEPTH;
    if (floodLevel <= 0 && Math.random() < floodProb) {
      setFloodProb(0);
      const newRainLevel = Math.floor(
        Math.random() * (MAX_RAIN - RIVER_DEPTH) + 1 + RIVER_DEPTH
      );
      const newFloodLevel =
        sedimentLevel + subsidenceLevel + newRainLevel - RIVER_DEPTH;
      return newFloodLevel > 10 ? 10 : newFloodLevel;
    }
    if (floodLevel <= 0) {
      setFloodProb(floodProb + (1 - floodProb) * 0.5);
    }
    return floodLevel > 10 ? 10 : floodLevel < 0 ? 0 : floodLevel;
  };

  const next = () => {
    const temp = nextFlag;
    setNextFlag(temp + 1);
    const floodLevel = getFloodLevel();
    setFlood({ round: temp + 1, level: floodLevel });
    setRemainingDredges(DREDGE_PER_ROUND);
    if (floodLevel > 0) {
      toast.error(`There was a flood of level ${floodLevel}`, {
        position: "bottom-center",
      });
    } else {
      toast.success("There was no flood", {
        position: "bottom-center",
      });
    }
  };

  const dredge = () => {
    setRemainingDredges(remainingDredges - 1);
    setSediment(sediment - DREDGE_EFFECT < 0 ? 0 : sediment - DREDGE_EFFECT);
    setGovBudget(govBudget - DREDGE_COST);
  };

  return (
    <div className="flex flex-col">
      <div className="w-full">
        {player.length === 0 && Object.entries(PlayerType).map(([key, value]) => <button key={key} className="rounded-md px-8 mx-8 bg-red-200 text-lg font-bold" onClick={() => setPlayer(value)}>{key}</button>)}
        {player.length > 0 && <p className="text-lg font-bold">{`Current Role: ${player}`}</p>}
        {/* {player === PlayerType.MODERATOR && <button onClick={() => resetGameState(player)} className="rounded-md px-8 mx-8 bg-red-200 text-lg font-bold">RESET</button>} */}
      </div>
      <div className="flex flex-row items-start mx-10 mt-10 gap-8">


        <div className={`flex flex-col gap-8 items-center justify-center w-64 ${player === PlayerType.MODERATOR ? '' : 'pointer-events-none opacity-40'}`}>
          {/* <div className="flex gap-20 items-center justify-center w-full"> */}
          <p className="font-bold text-2xl">GAME STATS</p>
          <p className="font-semibold">{`Sediment Level: ${sediment}`}</p>
          <p className="font-semibold">{`Subsidence Level: ${subsidence}`}</p>
          <p className="font-semibold">{`Government Budget: $${govBudget}`}</p>
          {/* </div> */}
          {/* <div className="flex gap-20 items-center justify-center w-full mt-8"> */}
          <button className="btn bg-red-300 w-full" onClick={restart}>
            Reset Game
          </button>
          <button className="btn bg-green-300 w-full" onClick={next}>
            Next Round
          </button>
          <button
            className="btn bg-yellow-300 w-full"
            onClick={dredge}
            disabled={govBudget < DREDGE_COST || remainingDredges < 1}
          >
            Dredge
          </button>
          {/* </div> */}
        </div>

        <div className="flex flex-row flex-shrink-0 justify-center">
          <Table
            id="resident"
            isRotated={true}
            title="Residential Area"
            role={Role.RESIDENTS}
            resetFlag={resetFlag}
            nextFlag={nextFlag}
            flood={flood}
            addSediment={setSediment1}
            increaseSubsidence={setSubsidence1}
            payTax={setTax1}
            player={player}
          />
          <Table
            id="corporate"
            isRotated={false}
            title="Industrial Area"
            role={Role.COMPANIES}
            resetFlag={resetFlag}
            nextFlag={nextFlag}
            flood={flood}
            addSediment={setSediment2}
            increaseSubsidence={setSubsidence2}
            payTax={setTax2}
            player={player}
          />
        </div>
        <Toaster />
      </div>
    </div>
  );
};

export default Board;
