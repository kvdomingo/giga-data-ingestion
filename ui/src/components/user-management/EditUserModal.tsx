import { useState } from "react";
import { createPortal } from "react-dom";
import { Controller, SubmitHandler, useForm } from "react-hook-form";

import { Add } from "@carbon/icons-react";
import {
  Button,
  FormGroup,
  InlineNotification,
  Modal,
  Select,
  SelectItem,
  Stack,
  TextInput,
} from "@carbon/react";
import MultiSelect from "@carbon/react/lib/components/MultiSelect/MultiSelect";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api";
import countries from "@/constants/countries";
import { GraphUser } from "@/types/user";
import { filterCountries, filterRoles } from "@/utils/group";
import { matchNamesWithIds } from "@/utils/group";
import {
  getUniqueDatasets,
  pluralizeCountries,
  pluralizeDatasets,
} from "@/utils/string";

interface EditUserModalProps {
  initialValues: GraphUser;
  isEditModalOpen: boolean;
  setIsEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEditUserSuccessNotification: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  setShowEditUserErrorNotification: React.Dispatch<
    React.SetStateAction<boolean>
  >;
}

type CountryDataset = {
  country: string;
  dataset: { selectedItems: { label: string; value: string }[] };
};

interface EditUserInputs {
  givenName: string;
  surname: string;
  email: string;
  roles: { selectedItems: { label: string; value: string }[] };
  countryDatasets: CountryDataset[];
}

export default function EditUserModal({
  initialValues,
  isEditModalOpen,
  setIsEditModalOpen,
  setShowEditUserErrorNotification,
  setShowEditUserSuccessNotification,
}: EditUserModalProps) {
  const initialId = initialValues.id;
  const givenName = initialValues.given_name;
  const surname = initialValues.surname;
  const initialEmail = initialValues.mail;
  const initialGroups = initialValues.member_of.map(
    group => group.display_name,
  );

  const api = useApi();
  const [swapModal, setSwapModal] = useState<boolean>(false);

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: api.groups.list,
  });

  const groups =
    groupsData?.data.map(group => {
      return { id: group.id, name: group.display_name };
    }) ?? [];

  const modifyUserAccess = useMutation({
    mutationFn: api.groups.modify_user_access,
  });

  const deriveInitialCountryDataset = (
    countryDataset: string[],
  ): CountryDataset[] => {
    return countryDataset
      .map(item => {
        const [country, dataset] = item.split("-");
        return {
          country,
          dataset: { selectedItems: [{ value: dataset, label: dataset }] },
        };
      })
      .reduce((acc: CountryDataset[], { country, dataset }) => {
        const existingCountry = acc.find(item => item.country === country);
        if (existingCountry) {
          existingCountry.dataset.selectedItems.push(...dataset.selectedItems);
        } else {
          acc.push({ country, dataset });
        }
        return acc;
      }, []);
  };

  const roles = filterRoles(groups.map(group => group.name));
  const initialRoles = {
    selectedItems: filterRoles(initialGroups).map(role => ({
      label: role,
      value: role,
    })),
  };

  const initialCountries = filterCountries(initialGroups);
  const initialCountryDataset = deriveInitialCountryDataset(initialCountries);

  const {
    control,
    formState,
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<EditUserInputs>({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      roles: initialRoles,
      countryDatasets: [...initialCountryDataset],
    },
  });

  const watchedCountryDatasets = watch("countryDatasets");
  const watchedRoles = watch("roles");

  const handleAddCountryDataset = () => {
    const emptyCountryDataset: CountryDataset = {
      country: "",
      dataset: { selectedItems: [] },
    };

    setValue("countryDatasets", [
      ...watchedCountryDatasets,
      { ...emptyCountryDataset },
    ]);
  };

  const handleModalCancel = (modalName: string) => {
    if (modalName == "EditModal") setIsEditModalOpen(false);
    setSwapModal(false);
  };

  const handleRemoveCountryDataset = (index: number) => {
    const countryDatasets = [...watchedCountryDatasets];
    countryDatasets.splice(index, 1);
    setValue("countryDatasets", countryDatasets);
  };

  const countryOptions = countries.map(country => ({
    value: country.name,
    label: country.name,
  }));

  const dataSetOptions = [
    "School Coverage",
    "School Geolocation",
    "School QoS",
  ].map(dataset => ({
    value: dataset,
    label: dataset,
  }));

  const roleOptions = roles.map(role => ({
    value: role,
    label: role,
  }));

  const deriveAddedValues = () => {
    const roles = [...watchedRoles.selectedItems];

    const addedDatasets = watchedCountryDatasets
      .flatMap(({ country, dataset }) =>
        dataset.selectedItems.map(item => ({
          country,
          dataset: item.value,
        })),
      )
      .filter(
        newDataset =>
          !initialCountryDataset.some(
            initialDataset =>
              initialDataset.country === newDataset.country &&
              initialDataset.dataset.selectedItems.some(
                item => item.value === newDataset.dataset,
              ),
          ),
      )
      .map(({ country, dataset }) => `${country}-${dataset}`);

    const addedDatasetsWithIds = matchNamesWithIds(addedDatasets, groups);

    const removedDatasets = initialCountryDataset
      .flatMap(({ country, dataset }) =>
        dataset.selectedItems.map(item => ({
          country,
          dataset: item.value,
        })),
      )
      .filter(
        initialDataset =>
          !watchedCountryDatasets.some(
            newDataset =>
              newDataset.country === initialDataset.country &&
              newDataset.dataset.selectedItems.some(
                item => item.value === initialDataset.dataset,
              ),
          ),
      )
      .map(({ country, dataset }) => `${country}-${dataset}`);

    const removedDatasetsWithIds = matchNamesWithIds(removedDatasets, groups);

    const addedRoles = roles.filter(
      role =>
        !initialRoles.selectedItems.some(
          initialRole => role.value == initialRole.value,
        ),
    );
    const addedRolesWithIds = matchNamesWithIds(
      addedRoles.map(role => role.value),
      groups,
    );

    const removedRoles = initialRoles.selectedItems.filter(
      initialRole => !roles.some(role => role.value == initialRole.value),
    );
    const removedRolesWithIds = matchNamesWithIds(
      removedRoles.map(role => role.value),
      groups,
    );

    return {
      addedDatasets,
      addedDatasetsWithIds,
      removedDatasets,
      removedDatasetsWithIds,
      addedRoles,
      addedRolesWithIds,
      removedRoles,
      removedRolesWithIds,
    };
  };

  const onSubmit: SubmitHandler<EditUserInputs> = async () => {
    const {
      addedDatasetsWithIds,
      addedRolesWithIds,
      removedDatasetsWithIds,
      removedRolesWithIds,
    } = deriveAddedValues();
    const editGroupsPayload = {
      groups_to_add: [
        ...addedDatasetsWithIds.map(
          addedDatasetWithId => addedDatasetWithId.id ?? "",
        ),
        ...addedRolesWithIds.map(addedRoleWithId => addedRoleWithId.id ?? ""),
      ],
      groups_to_remove: [
        ...removedDatasetsWithIds.map(
          removedDatasetWithId => removedDatasetWithId.id ?? "",
        ),
        ...removedRolesWithIds.map(
          removedRoleWithId => removedRoleWithId.id ?? "",
        ),
      ],
      user_id: initialId,
      email: initialEmail,
    };

    try {
      await modifyUserAccess.mutateAsync(editGroupsPayload);
      setShowEditUserSuccessNotification(true);
      reset();
      setSwapModal(false);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error(err);
      setShowEditUserErrorNotification(true);
    }
  };

  return (
    <>
      {isEditModalOpen &&
        createPortal(
          <Modal
            aria-label="edit user modal"
            hasScrollingContent
            modalHeading="Edit user"
            open={isEditModalOpen && !swapModal}
            preventCloseOnClickOutside
            primaryButtonDisabled={!formState.isValid}
            primaryButtonText="Confirm"
            secondaryButtonText="Cancel"
            onRequestClose={() => handleModalCancel("EditModal")}
            onRequestSubmit={() => setSwapModal(true)}
          >
            {isEditModalOpen && (
              <form aria-label="edit user form">
                <Stack gap={4}>
                  <TextInput
                    id="givenName"
                    labelText="First Name"
                    readOnly
                    value={givenName}
                    {...register("givenName", { required: true })}
                  />
                  <TextInput
                    id="surname"
                    labelText="Last Name"
                    readOnly
                    value={surname}
                    {...register("surname", { required: true })}
                  />
                  <TextInput
                    id="email"
                    labelText="Email"
                    readOnly
                    value={initialEmail}
                    {...register("email", { required: true })}
                  />
                  <Controller
                    name="roles"
                    control={control}
                    render={({ field }) => (
                      <MultiSelect
                        id="roles"
                        initialSelectedItems={watchedRoles.selectedItems}
                        items={roleOptions}
                        itemToString={item => item.label}
                        label="What level of access does this user have for Giga?"
                        titleText="Role"
                        {...field}
                      />
                    )}
                    rules={{ required: true, minLength: 1 }}
                  />

                  {watchedCountryDatasets.map((countryDataset, i) => (
                    <FormGroup key={i} legendText="">
                      <Select
                        id={`country.${i}`}
                        labelText={`Country ${i + 1}`}
                        placeholder="Select a country"
                        {...register(`countryDatasets.${i}.country`, {
                          required: true,
                        })}
                      >
                        <SelectItem text="Select a country" value="" />
                        {countryOptions.map(country => (
                          <SelectItem
                            key={country.value}
                            text={country.label}
                            value={country.value}
                          />
                        ))}
                      </Select>
                      {watchedCountryDatasets.length > 1 && (
                        <Button
                          kind="ghost"
                          size="sm"
                          onClick={() => handleRemoveCountryDataset(i)}
                        >
                          Remove pair
                        </Button>
                      )}
                      <FormGroup legendText="Dataset">
                        <Controller
                          name={`countryDatasets.${i}.dataset`}
                          control={control}
                          render={({ field }) => (
                            <MultiSelect
                              id={`dataset.${i}`}
                              label="Select datasets"
                              initialSelectedItems={
                                countryDataset.dataset.selectedItems
                              }
                              items={dataSetOptions}
                              itemToString={item => item.label}
                              {...field}
                            />
                          )}
                          rules={{ required: true, minLength: 1 }}
                        />
                      </FormGroup>
                      {i + 1 < watchedCountryDatasets.length && (
                        <hr className="mt-8 opacity-30" />
                      )}
                    </FormGroup>
                  ))}

                  <Button
                    kind="ghost"
                    renderIcon={Add}
                    onClick={handleAddCountryDataset}
                  >
                    Add country
                  </Button>
                </Stack>
              </form>
            )}
          </Modal>,

          document.body,
        )}

      {isEditModalOpen &&
        swapModal &&
        createPortal(
          <Modal
            aria-label="confirm edit user modal"
            loadingStatus={modifyUserAccess.isPending ? "active" : "inactive"}
            modalHeading="Confirm New User"
            open={isEditModalOpen && swapModal}
            primaryButtonText="Confirm"
            secondaryButtonText="Cancel"
            onRequestClose={() => handleModalCancel("ConfirmModal")}
            onRequestSubmit={() => {
              handleSubmit(onSubmit)();
            }}
          >
            <form aria-label="confirm edit user form">
              {(() => {
                const countries = getUniqueDatasets(
                  getValues("email"),
                  deriveAddedValues().addedDatasetsWithIds,
                ).countries;
                const datasets = pluralizeDatasets(
                  getUniqueDatasets(
                    getValues("email"),
                    deriveAddedValues().addedDatasetsWithIds,
                  ).uniqueDatasets,
                );

                return (
                  <p>
                    This will give the user with email{" "}
                    <b>{getValues("email")}</b> access to Giga data for{" "}
                    <b>{datasets}</b> across {countries.length}{" "}
                    {countries.length === 1 ? "country" : "countries"}:{" "}
                    <b>{pluralizeCountries(countries)}</b>.
                  </p>
                );
              })()}

              {modifyUserAccess.isError && (
                <InlineNotification
                  aria-label="create user error notification"
                  kind="error"
                  statusIconDescription="notification"
                  subtitle="Operation failed. Please try again."
                  title="Error"
                />
              )}
            </form>
          </Modal>,
          document.body,
        )}
    </>
  );
}
