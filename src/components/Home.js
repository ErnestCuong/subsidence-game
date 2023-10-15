import { FaHome } from "react-icons/fa";

const Home = ({ onClick }) => {
  return (
    <button className="bg-yellow-300 w-full h-full flex justify-center items-center" onClick={onClick}>
      <FaHome/>
    </button>
  )
}

export default Home