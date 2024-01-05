import { useEffect, useState } from "react"
import Table, { Role } from "./Table"
import { Toaster, toast } from 'react-hot-toast';

const RIVER_DEPTH = 20;
const MAX_RAIN = 25;

const Board = () => {
	const [resetFlag, setResetFlag] = useState(0)
	const [nextFlag, setNextFlag] = useState(0)
	const [flood, setFlood] = useState({ round: 0, level: 0 })
	const [sediment, setSediment] = useState(JSON.parse(localStorage.getItem("sediment"))?.sediment ?? 0)
	const [sediment1, setSediment1] = useState(-1)
	const [sediment2, setSediment2] = useState(-1)

	const [subsidence, setSubsidence] = useState(JSON.parse(localStorage.getItem("subsidence"))?.subsidence ?? 0)
	const [subsidence1, setSubsidence1] = useState(-1)
	const [subsidence2, setSubsidence2] = useState(-1)
	const [floodProb, setFloodProb] = useState(0)

	useEffect(() => {
		localStorage.setItem("sediment", JSON.stringify({ sediment: sediment }))
	}, [sediment])

	useEffect(() => {
		localStorage.setItem("subsidence", JSON.stringify({ subsidence: subsidence }))
	}, [subsidence])

	const addSediment = (value) => {
		if (sediment + value > RIVER_DEPTH * 30) {
			setSediment(RIVER_DEPTH * 30)
			return
		}
		setSediment(sediment + value)
	}

	const increaseSubsidence = (value) => {
		if (subsidence + value > RIVER_DEPTH * 15) {
			setSubsidence(RIVER_DEPTH * 15)
			return
		}
		setSubsidence(subsidence + value)
	}

	const removeSediment = (value) => {
		setSediment(sediment - value)
	}

	useEffect(() => {
		if (sediment1 > -1 && sediment2 > -1) {
			addSediment(sediment1 + sediment2)
			setSediment1(-1)
			setSediment2(-1)
		}
	}, [sediment1, sediment2])

	useEffect(() => {
		if (subsidence1 > -1 && subsidence2 > -1) {
			increaseSubsidence(subsidence1 + subsidence2)
			setSubsidence1(-1)
			setSubsidence2(-1)
		}
	}, [subsidence1, subsidence2])

	const restart = () => {
		localStorage.removeItem('resident')
		localStorage.removeItem('corporate')
		setResetFlag(resetFlag + 1)
		setNextFlag(0)
		setSediment(0)
		setSubsidence(0)
		toast.success('New Game!', {
			position: "bottom-center"
		})
	}

	const getFloodLevel = () => {
		const rainLevel = Math.floor(Math.random() * MAX_RAIN)
		const sedimentLevel = Math.floor(sediment / 20)
		const subsidenceLevel = Math.floor(subsidence / 10)
		const floodLevel = sedimentLevel + rainLevel + subsidenceLevel - RIVER_DEPTH
		if (floodLevel <= 0 && Math.random() < floodProb) {
			setFloodProb(0)
			const newRainLevel = Math.floor(Math.random() * (MAX_RAIN - RIVER_DEPTH) + 1 + RIVER_DEPTH)
			const newFloodLevel = sedimentLevel + subsidenceLevel + newRainLevel - RIVER_DEPTH
			return newFloodLevel > 10 ? 10 : newFloodLevel
		}
		if (floodLevel <= 0) {
			setFloodProb(floodProb + (1-floodProb)*0.5)
		}
		return floodLevel > 10 ? 10 : floodLevel < 0 ? 0 : floodLevel
	}

	const next = () => {
		const temp = nextFlag
		setNextFlag(temp + 1)
		const floodLevel = getFloodLevel()
		setFlood({ round: temp + 1, level: floodLevel })
		if (floodLevel > 0) {
			toast.error(`There was a flood of level ${floodLevel}`, {
				position: "bottom-center"
			})
		} else {
			toast.success('There was no flood', {
				position: "bottom-center"
			})
		}
	}

	return (
		<div className="flex flex-col items-start mx-10">
			<div className="flex gap-20 items-center justify-center w-full">
				<p className="font-bold">{`Sediment Level: ${sediment}`}</p>
				<p className="font-bold">{`Subsidence Level: ${subsidence}`}</p>
				<button className="btn bg-red-300" onClick={restart}>Reset Game</button>
				<button className="btn bg-green-300" onClick={next}>Next Round</button>
			</div>
			<div className="flex flex-row flex-shrink-0 mt-10 w-full justify-center">
				<Table id="resident" isRotated={true} title="Residential Area" role={Role.RESIDENTS} resetFlag={resetFlag} nextFlag={nextFlag} flood={flood} addSediment={setSediment1} increaseSubsidence={setSubsidence1}/>
				<Table id="corporate" isRotated={false} title="Industrial Area" role={Role.COMPANIES} resetFlag={resetFlag} nextFlag={nextFlag} flood={flood} addSediment={setSediment2} increaseSubsidence={setSubsidence2}/>
			</div>
			<Toaster />
		</div>
	)
}

export default Board