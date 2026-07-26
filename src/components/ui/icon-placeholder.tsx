import * as React from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  EllipsisHorizontalIcon,
  EllipsisVerticalIcon,
  MinusIcon,
  PlusCircleIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const heroiconByLucideName = {
  ArrowDownIcon: ArrowDownIcon,
  ArrowLeftIcon: ArrowLeftIcon,
  ArrowLeftToLineIcon: ChevronDoubleLeftIcon,
  ArrowRightIcon: ArrowRightIcon,
  ArrowRightToLineIcon: ChevronDoubleRightIcon,
  ArrowUpIcon: ArrowUpIcon,
  CheckIcon: CheckIcon,
  ChevronDownIcon: ChevronDownIcon,
  ChevronLeftIcon: ChevronLeftIcon,
  ChevronRightIcon: ChevronRightIcon,
  ChevronsUpDownIcon: ChevronUpDownIcon,
  ChevronUpIcon: ChevronUpIcon,
  CirclePlusIcon: PlusCircleIcon,
  GripHorizontalIcon: EllipsisHorizontalIcon,
  GripVerticalIcon: EllipsisVerticalIcon,
  Loader2Icon: ArrowPathIcon,
  MinusIcon: MinusIcon,
  PinOffIcon: XMarkIcon,
  PlusIcon: PlusIcon,
  Settings2Icon: AdjustmentsHorizontalIcon,
} as const;

interface IconPlaceholderProps extends React.ComponentProps<"svg"> {
  lucide: keyof typeof heroiconByLucideName;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
}

function IconPlaceholder(allProps: IconPlaceholderProps) {
  const { lucide, tabler, hugeicons, phosphor, remixicon, ...props } = allProps;
  void tabler;
  void hugeicons;
  void phosphor;
  void remixicon;
  const Icon = heroiconByLucideName[lucide];
  return <Icon aria-hidden={props["aria-label"] ? undefined : true} {...props} />;
}

export { IconPlaceholder };
